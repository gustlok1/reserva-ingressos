import type { Clock } from '../../lib/clock';
import { notFound } from '../../lib/errors';
import type { EventRow, EventsRepository } from './events.repository';

// Formato público do evento na API (camelCase, sem detalhes do banco).
export function toEventDto(row: EventRow, now: string) {
  return {
    id: row.id,
    name: row.name,
    venue: row.venue,
    startsAt: row.starts_at,
    priceCents: row.price_cents,
    capacity: row.capacity,
    available: Math.max(0, row.available), // a invariante garante >= 0; o max é só defesa extra
    hasStarted: now >= row.starts_at,
  };
}

export function createEventsService(repository: EventsRepository, clock: Clock) {
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
  };
}

export type EventsService = ReturnType<typeof createEventsService>;
