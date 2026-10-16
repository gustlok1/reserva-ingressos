import { describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { openDatabase } from '../src/db/connection';
import { runMigrations } from '../src/db/migrate';
import { DEMO_PASSWORD, seed } from '../src/db/seed';

function count(db: ReturnType<typeof openDatabase>, table: string) {
  return (db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total;
}

describe('migrations e seed', () => {
  it('rodar migrations duas vezes não reaplica nada', () => {
    const db = openDatabase(':memory:');
    expect(runMigrations(db)).toEqual(['001_init.sql', '002_extras.sql']);
    expect(runMigrations(db)).toEqual([]);
  });

  it('seed é idempotente e cria 2 usuários + 1 admin e 3 eventos futuros, um com capacidade 2', () => {
    const db = openDatabase(':memory:');
    runMigrations(db);
    const now = new Date('2026-10-16T12:00:00.000Z');

    expect(seed(db, now)).toEqual({ usersInserted: 3, eventsInserted: 3 });
    expect(seed(db, now)).toEqual({ usersInserted: 0, eventsInserted: 0 });
    expect(count(db, 'users')).toBe(3);
    expect(count(db, 'events')).toBe(3);

    const events = db.prepare('SELECT starts_at, capacity FROM events').all() as { starts_at: string; capacity: number }[];
    expect(events.every((event) => event.starts_at > now.toISOString())).toBe(true);
    expect(events.some((event) => event.capacity === 2)).toBe(true);
  });

  it('senha é armazenada como hash bcrypt', () => {
    const db = openDatabase(':memory:');
    runMigrations(db);
    seed(db);

    const user = db.prepare('SELECT password_hash FROM users LIMIT 1').get() as { password_hash: string };
    expect(user.password_hash).not.toBe(DEMO_PASSWORD);
    expect(bcrypt.compareSync(DEMO_PASSWORD, user.password_hash)).toBe(true);
  });

  it('o banco recusa reserva com quantidade fora de 1 a 4 (CHECK)', () => {
    const db = openDatabase(':memory:');
    runMigrations(db);
    seed(db);

    const insert = (quantity: number) =>
      db
        .prepare(
          `INSERT INTO reservations (user_id, event_id, quantity, unit_price_cents, total_cents, status, created_at, expires_at, updated_at)
           VALUES (1, 1, ?, 100, ?, 'PENDING', 'x', 'x', 'x')`,
        )
        .run(quantity, quantity * 100);

    expect(() => insert(5)).toThrow(/CHECK/);
    expect(() => insert(0)).toThrow(/CHECK/);
    expect(() => insert(2)).not.toThrow();
  });
});
