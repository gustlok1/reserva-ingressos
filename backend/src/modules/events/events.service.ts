import { transaction, type Database } from '../../db/connection';
import { DEFAULT_EVENT_IMAGE } from './constants';
import type { Clock } from '../../lib/clock';
import { badRequest, conflict, notFound } from '../../lib/errors';
import type { EventInput, EventRow, EventsRepository } from './events.repository';

// Formato público do evento na API (camelCase, sem detalhes do banco).
export function toEventDto(row: EventRow, now: string) {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.subtitle,
    venue: row.venue,
    startsAt: row.starts_at,
    imageUrl: row.image_url || DEFAULT_EVENT_IMAGE,
    priceCents: row.price_cents,
    capacity: row.capacity,
    available: Math.max(0, row.available), // a invariante garante >= 0; o max é só defesa extra
    hasStarted: now >= row.starts_at,
  };
}

// "Rock na Arena!" → "rock-na-arena"
const slugify = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function createEventsService(repository: EventsRepository, clock: Clock, db: Database) {
  const assertFuture = (startsAt: string, now: string) => {
    if (startsAt <= now) throw badRequest('INVALID_DATE', 'A data do evento precisa estar no futuro.');
  };

  return {
    list({ search, page, pageSize }: { search?: string; page: number; pageSize: number }) {
      const now = clock.now().toISOString();
      const { rows, total } = repository.list({ search, limit: pageSize, offset: (page - 1) * pageSize, now });

      return {
        data: rows.map((row) => toEventDto(row, now)),
        pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      };
    },

    get(id: number) {
      const now = clock.now().toISOString();
      const row = repository.findById(id, now);
      if (!row) throw notFound('Evento não encontrado.');
      return toEventDto(row, now);
    },

    // ---------- Administração (extra pós-entrega) ----------

    create(input: EventInput) {
      const now = clock.now().toISOString();
      assertFuture(input.startsAt, now);

      // Sufixo com o horário garante slug único mesmo para dois eventos com o mesmo nome.
      const slug = `${slugify(input.name)}-${Date.now().toString(36)}`;
      const id = repository.insert({ ...input, slug, createdAt: now });
      return toEventDto(repository.findById(id, now)!, now);
    },

    /**
     * Editar não pode deixar a capacidade abaixo do que já está ocupado (confirmadas + pendentes válidas).
     * A conta e o UPDATE rodam na mesma transação com lock (a mesma das reservas):
     * uma reserva criada "no meio" da edição não consegue furar a regra.
     * Mudar o preço não altera reservas existentes, que guardam o preço do momento em que foram feitas.
     */
    update(id: number, input: EventInput) {
      const now = clock.now().toISOString();
      assertFuture(input.startsAt, now);

      const row = transaction(db, () => {
        const current = repository.findById(id, now);
        if (!current) throw notFound('Evento não encontrado.');

        const occupied = current.capacity - current.available;
        if (input.capacity < occupied) {
          throw conflict('CAPACITY_BELOW_OCCUPIED', `Já existem ${occupied} ingressos vendidos ou reservados; a capacidade não pode ser menor.`);
        }

        repository.update(id, input);
        return repository.findById(id, now)!;
      });
      return toEventDto(row, now);
    },
  };
}

export type EventsService = ReturnType<typeof createEventsService>;
