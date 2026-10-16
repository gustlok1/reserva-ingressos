import bcrypt from 'bcryptjs';
import { transaction, type Database } from './connection';

export const DEMO_PASSWORD = 'senha123';

export const DEMO_USERS = [
  { email: 'ana@exemplo.com', name: 'Ana Souza' },
  { email: 'bruno@exemplo.com', name: 'Bruno Lima' },
];

// Datas relativas ao momento do seed para os eventos serem sempre futuros.
export const DEMO_EVENTS = [
  { slug: 'rock-na-arena', name: 'Rock na Arena', venue: 'Arena Barueri', daysFromNow: 10, priceCents: 15000, capacity: 100 },
  { slug: 'final-do-campeonato', name: 'Final do Campeonato', venue: 'Estádio Municipal de Barueri', daysFromNow: 20, priceCents: 8000, capacity: 50 },
  { slug: 'camarote-noite-eletronica', name: 'Camarote VIP - Noite Eletrônica', venue: 'Espaço Dry', daysFromNow: 30, priceCents: 45000, capacity: 2 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seed idempotente: ON CONFLICT DO NOTHING usa as chaves únicas (email, slug),
 * então rodar várias vezes não duplica nada nem sobrescreve o que já existe.
 */
export function seed(db: Database, now = new Date()) {
  const createdAt = now.toISOString();
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  return transaction(db, () => {
    const insertUser = db.prepare(`
      INSERT INTO users (email, name, password_hash, created_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT (email) DO NOTHING
    `);
    let usersInserted = 0;
    for (const user of DEMO_USERS) {
      usersInserted += Number(insertUser.run(user.email, user.name, passwordHash, createdAt).changes);
    }

    const insertEvent = db.prepare(`
      INSERT INTO events (slug, name, venue, starts_at, price_cents, capacity, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (slug) DO NOTHING
    `);
    let eventsInserted = 0;
    for (const event of DEMO_EVENTS) {
      const startsAt = new Date(now.getTime() + event.daysFromNow * DAY_MS);
      startsAt.setUTCHours(23, 0, 0, 0); // 20h no horário de Brasília
      eventsInserted += Number(
        insertEvent.run(event.slug, event.name, event.venue, startsAt.toISOString(), event.priceCents, event.capacity, createdAt).changes,
      );
    }

    return { usersInserted, eventsInserted };
  });
}
