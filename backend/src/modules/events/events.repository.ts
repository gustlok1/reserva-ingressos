import type { Database } from '../../db/connection';

export interface EventRow {
  id: number;
  name: string;
  venue: string;
  starts_at: string;
  price_cents: number;
  capacity: number;
  available: number;
}

/**
 * Ingressos ocupados de um evento: reservas CONFIRMED + PENDING ainda válidas (expires_at > agora).
 * CANCELLED, EXPIRED e PENDING vencidas não entram. O parâmetro `?` é o "agora" em ISO.
 * É a única definição da regra de disponibilidade; a criação de reserva (fase 5) usa a mesma.
 */
const OCCUPIED_SQL = `
  COALESCE((
    SELECT SUM(r.quantity) FROM reservations r
    WHERE r.event_id = e.id
      AND (r.status = 'CONFIRMED' OR (r.status = 'PENDING' AND r.expires_at > ?))
  ), 0)
`;

const SELECT_EVENT = `
  SELECT e.id, e.name, e.venue, e.starts_at, e.price_cents, e.capacity,
         e.capacity - ${OCCUPIED_SQL} AS available
  FROM events e
`;

// Escapa os curingas do LIKE (% e _) para a busca tratar o texto do usuário literalmente.
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

export function createEventsRepository(db: Database) {
  return {
    list({ search, limit, offset, now }: { search?: string; limit: number; offset: number; now: string }) {
      const where = search ? `WHERE e.name LIKE ? ESCAPE '\\'` : '';
      const searchParams = search ? [`%${escapeLike(search)}%`] : [];

      const rows = db
        .prepare(`${SELECT_EVENT} ${where} ORDER BY e.starts_at, e.id LIMIT ? OFFSET ?`)
        .all(now, ...searchParams, limit, offset) as unknown as EventRow[];

      const { total } = db.prepare(`SELECT COUNT(*) AS total FROM events e ${where}`).get(...searchParams) as { total: number };
      return { rows, total };
    },

    findById(id: number, now: string) {
      return db.prepare(`${SELECT_EVENT} WHERE e.id = ?`).get(now, id) as EventRow | undefined;
    },
  };
}

export type EventsRepository = ReturnType<typeof createEventsRepository>;
