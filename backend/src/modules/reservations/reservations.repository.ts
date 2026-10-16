import type { Database } from '../../db/connection';

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export interface ReservationRow {
  id: number;
  user_id: number;
  event_id: number;
  quantity: number;
  unit_price_cents: number;
  total_cents: number;
  status: ReservationStatus;
  created_at: string;
  expires_at: string;
  confirmed_at: string | null;
  cancelled_at: string | null;
  event_name: string;
  event_venue: string;
  event_starts_at: string;
}

// Toda leitura traz os dados do evento junto, para a tela "Minhas reservas" não precisar de outra chamada.
const SELECT_RESERVATION = `
  SELECT r.id, r.user_id, r.event_id, r.quantity, r.unit_price_cents, r.total_cents, r.status,
         r.created_at, r.expires_at, r.confirmed_at, r.cancelled_at,
         e.name AS event_name, e.venue AS event_venue, e.starts_at AS event_starts_at
  FROM reservations r
  JOIN events e ON e.id = r.event_id
`;

export function createReservationsRepository(db: Database) {
  return {
    insert(data: { userId: number; eventId: number; quantity: number; unitPriceCents: number; createdAt: string; expiresAt: string }) {
      const result = db
        .prepare(
          `INSERT INTO reservations (user_id, event_id, quantity, unit_price_cents, total_cents, status, created_at, expires_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`,
        )
        .run(
          data.userId,
          data.eventId,
          data.quantity,
          data.unitPriceCents,
          data.quantity * data.unitPriceCents,
          data.createdAt,
          data.expiresAt,
          data.createdAt,
        );
      return Number(result.lastInsertRowid);
    },

    // Sempre filtra pelo dono: a reserva de outro usuário é indistinguível de uma inexistente.
    findForUser(id: number, userId: number) {
      return db.prepare(`${SELECT_RESERVATION} WHERE r.id = ? AND r.user_id = ?`).get(id, userId) as ReservationRow | undefined;
    },

    listForUser(userId: number) {
      return db
        .prepare(`${SELECT_RESERVATION} WHERE r.user_id = ? ORDER BY r.created_at DESC, r.id DESC`)
        .all(userId) as unknown as ReservationRow[];
    },

    // O "AND status = 'PENDING'" garante que só uma transição sai de PENDING:
    // estados finais nunca são sobrescritos, mesmo que o código acima tenha um bug.
    markConfirmed(id: number, now: string) {
      db.prepare(`UPDATE reservations SET status = 'CONFIRMED', confirmed_at = ?, updated_at = ? WHERE id = ? AND status = 'PENDING'`).run(
        now,
        now,
        id,
      );
    },

    markCancelled(id: number, now: string) {
      db.prepare(`UPDATE reservations SET status = 'CANCELLED', cancelled_at = ?, updated_at = ? WHERE id = ? AND status = 'PENDING'`).run(
        now,
        now,
        id,
      );
    },

    markExpired(id: number, now: string) {
      db.prepare(`UPDATE reservations SET status = 'EXPIRED', updated_at = ? WHERE id = ? AND status = 'PENDING'`).run(now, id);
    },
  };
}

export type ReservationsRepository = ReturnType<typeof createReservationsRepository>;
