import { transaction, type Database } from '../../db/connection';
import type { Clock } from '../../lib/clock';
import { AppError, conflict, notFound } from '../../lib/errors';
import { DEFAULT_EVENT_IMAGE } from '../events/constants';
import type { EventsRepository } from '../events/events.repository';
import type { ReservationRow, ReservationsRepository } from './reservations.repository';

// Uma PENDING cujo prazo passou já é EXPIRED para todos os efeitos, mesmo antes de o banco ser atualizado.
// Regra do enunciado: "horário do servidor >= expiresAt" significa expirada.
const isOverdue = (row: ReservationRow, now: string) => row.status === 'PENDING' && now >= row.expires_at;

export function toReservationDto(row: ReservationRow, now: string) {
  return {
    id: row.id,
    status: isOverdue(row, now) ? 'EXPIRED' : row.status,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    totalCents: row.total_cents,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    confirmedAt: row.confirmed_at,
    cancelledAt: row.cancelled_at,
    event: {
      id: row.event_id,
      name: row.event_name,
      subtitle: row.event_subtitle,
      venue: row.event_venue,
      startsAt: row.event_starts_at,
      imageUrl: row.event_image_url || DEFAULT_EVENT_IMAGE,
    },
  };
}

const expiredError = () => conflict('RESERVATION_EXPIRED', 'O prazo desta reserva terminou.');
const invalidStateError = (status: string) =>
  conflict('INVALID_RESERVATION_STATE', `Não é possível alterar uma reserva com status ${status}.`);

export function createReservationsService(deps: {
  db: Database;
  reservations: ReservationsRepository;
  events: EventsRepository;
  clock: Clock;
  ttlSeconds: number;
}) {
  const { db, reservations, events, clock, ttlSeconds } = deps;

  // Lê a reserva dentro da transação e, se o prazo passou, grava EXPIRED antes de seguir.
  // O erro é devolvido (não lançado) para o COMMIT acontecer: a expiração fica gravada mesmo com o 409.
  function loadForUpdate(id: number, userId: number, now: string): ReservationRow | AppError {
    const row = reservations.findForUser(id, userId);
    if (!row) return notFound('Reserva não encontrada.');
    if (isOverdue(row, now)) {
      reservations.markExpired(row.id, now);
      return expiredError();
    }
    if (row.status === 'EXPIRED') return expiredError();
    return row;
  }

  // Executa `fn` com lock de escrita e lança o erro só depois do COMMIT.
  function mutate(fn: (now: string) => ReservationRow | AppError) {
    const now = clock.now().toISOString();
    const result = transaction(db, () => fn(now));
    if (result instanceof AppError) throw result;
    return toReservationDto(result, now);
  }

  return {
    /**
     * Cria uma reserva PENDING. Tudo acontece dentro de BEGIN IMMEDIATE:
     * enquanto esta transação lê a disponibilidade e insere, nenhuma outra conexão
     * (nem de outra instância do backend) consegue escrever. A segunda requisição
     * espera o COMMIT e, ao ler, já enxerga a reserva da primeira.
     */
    create(userId: number, eventId: number, quantity: number) {
      const now = clock.now();
      const nowIso = now.toISOString();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

      const row = transaction(db, () => {
        const event = events.findById(eventId, nowIso); // `available` calculado com a mesma regra do catálogo
        if (!event) throw notFound('Evento não encontrado.');
        if (nowIso >= event.starts_at) throw conflict('EVENT_STARTED', 'Este evento já começou.');
        if (event.available < quantity) {
          throw conflict('INSUFFICIENT_AVAILABILITY', `Ingressos insuficientes. Disponíveis: ${Math.max(0, event.available)}.`);
        }

        // Preço vem do evento no banco, nunca do corpo da requisição.
        const id = reservations.insert({ userId, eventId, quantity, unitPriceCents: event.price_cents, createdAt: nowIso, expiresAt });
        return reservations.findForUser(id, userId)!;
      });

      return toReservationDto(row, nowIso);
    },

    list(userId: number) {
      const now = clock.now().toISOString();
      return reservations.listForUser(userId).map((row) => toReservationDto(row, now));
    },

    get(id: number, userId: number) {
      const now = clock.now().toISOString();
      const row = reservations.findForUser(id, userId);
      if (!row) throw notFound('Reserva não encontrada.');
      return toReservationDto(row, now);
    },

    // Idempotente: confirmar uma reserva já CONFIRMED devolve a mesma reserva, sem alterar nada.
    // Não consome capacidade de novo: a reserva já era contada como PENDING e continua contando como CONFIRMED.
    confirm(id: number, userId: number) {
      return mutate((now) => {
        const row = loadForUpdate(id, userId, now);
        if (row instanceof AppError || row.status === 'CONFIRMED') return row;
        if (row.status !== 'PENDING') return invalidStateError(row.status);

        reservations.markConfirmed(row.id, now);
        return reservations.findForUser(id, userId)!;
      });
    },

    // Só PENDING válida pode ser cancelada. Repetir o cancelamento cai em INVALID_RESERVATION_STATE (409).
    cancel(id: number, userId: number) {
      return mutate((now) => {
        const row = loadForUpdate(id, userId, now);
        if (row instanceof AppError) return row;
        if (row.status !== 'PENDING') return invalidStateError(row.status);

        reservations.markCancelled(row.id, now);
        return reservations.findForUser(id, userId)!;
      });
    },
  };
}

export type ReservationsService = ReturnType<typeof createReservationsService>;
