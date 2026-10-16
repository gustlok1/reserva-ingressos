import type { Database } from '../../db/connection';

export interface EventRow {
  id: number;
  name: string;
  subtitle: string | null;
  venue: string;
  starts_at: string;
  image_url: string | null;
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
  SELECT e.id, e.name, e.subtitle, e.venue, e.starts_at, e.image_url, e.price_cents, e.capacity,
         e.capacity - ${OCCUPIED_SQL} AS available
  FROM events e
`;

export interface EventInput {
  name: string;
  subtitle: string | null;
  venue: string;
  startsAt: string;
  priceCents: number;
  capacity: number;
  imageUrl: string | null;
}

// Escapa os curingas do LIKE (% e _) para a busca tratar o texto do usuário literalmente.
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

export function createEventsRepository(db: Database) {
  return {
    list({ search, limit, offset, now }: { search?: string; limit: number; offset: number; now: string }) {
      // unaccent() é a função registrada em openDatabase: "eletronica" encontra "Eletrônica".
      const where = search ? `WHERE unaccent(e.name) LIKE unaccent(?) ESCAPE '\\'` : '';
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

    insert(data: EventInput & { slug: string; createdAt: string }) {
      const result = db
        .prepare(
          `INSERT INTO events (slug, name, subtitle, venue, starts_at, price_cents, capacity, image_url, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(data.slug, data.name, data.subtitle, data.venue, data.startsAt, data.priceCents, data.capacity, data.imageUrl, data.createdAt);
      return Number(result.lastInsertRowid);
    },

    update(id: number, data: EventInput) {
      db.prepare(
        `UPDATE events SET name = ?, subtitle = ?, venue = ?, starts_at = ?, price_cents = ?, capacity = ?, image_url = ?
         WHERE id = ?`,
      ).run(data.name, data.subtitle, data.venue, data.startsAt, data.priceCents, data.capacity, data.imageUrl, id);
    },
  };
}

export type EventsRepository = ReturnType<typeof createEventsRepository>;
