import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Database } from '../src/db/connection';
import { createTestContext, loginAs, START } from './helpers';

const MINUTE = 60 * 1000;

function insertEvent(db: Database, slug: string, startsAt: string, capacity = 10) {
  const result = db
    .prepare(
      `INSERT INTO events (slug, name, venue, starts_at, price_cents, capacity, created_at)
       VALUES (?, ?, 'Local Teste', ?, 1000, ?, ?)`,
    )
    .run(slug, `Evento ${slug}`, startsAt, capacity, START.toISOString());
  return Number(result.lastInsertRowid);
}

function insertReservation(db: Database, eventId: number, quantity: number, status: string, expiresAt: string) {
  db.prepare(
    `INSERT INTO reservations (user_id, event_id, quantity, unit_price_cents, total_cents, status, created_at, expires_at, updated_at)
     VALUES (1, ?, ?, 1000, ?, ?, ?, ?, ?)`,
  ).run(eventId, quantity, quantity * 1000, status, START.toISOString(), expiresAt, START.toISOString());
}

describe('eventos', () => {
  // Extra pós-entrega: o catálogo é público (na versão de entrega, exigia login). Reservar continua exigindo.
  it('catálogo é público: lista e detalhe funcionam sem login', async () => {
    const { app } = createTestContext();
    await request(app).get('/api/events').expect(200);
    await request(app).get('/api/events/1').expect(200);
  });

  it('lista com os campos esperados, ordenada por data', async () => {
    const { app } = createTestContext();
    const agent = await loginAs(app, 'ana@exemplo.com');

    const res = await agent.get('/api/events').expect(200);

    expect(res.body.pagination).toEqual({ page: 1, pageSize: 10, total: 3, totalPages: 1 });
    expect(res.body.data.map((e: { name: string }) => e.name)).toEqual([
      'Rock na Arena',
      'Final do Campeonato',
      'Camarote VIP - Noite Eletrônica',
    ]);
    expect(res.body.data[0]).toEqual({
      id: 1,
      name: 'Rock na Arena',
      subtitle: 'Pista Premium',
      venue: 'Arena Barueri',
      startsAt: expect.any(String),
      imageUrl: '/images/evento-padrao.jpg',
      priceCents: 15000,
      capacity: 100,
      available: 100,
      hasStarted: false,
    });
  });

  it('pagina no servidor e desempata eventos na mesma data pelo id', async () => {
    const { app, db } = createTestContext();
    const sameDate = '2026-10-17T20:00:00.000Z'; // antes dos eventos do seed
    const a = insertEvent(db, 'a', sameDate);
    const b = insertEvent(db, 'b', sameDate);
    const agent = await loginAs(app, 'ana@exemplo.com');

    const page1 = await agent.get('/api/events?page=1&pageSize=2').expect(200);
    const page3 = await agent.get('/api/events?page=3&pageSize=2').expect(200);

    expect(page1.body.data.map((e: { id: number }) => e.id)).toEqual([a, b]);
    expect(page1.body.pagination).toEqual({ page: 1, pageSize: 2, total: 5, totalPages: 3 });
    expect(page3.body.data).toHaveLength(1);
  });

  it('busca por nome sem diferenciar maiúsculas e trata % literalmente', async () => {
    const { app } = createTestContext();
    const agent = await loginAs(app, 'ana@exemplo.com');

    const rock = await agent.get('/api/events?search=ROCK').expect(200);
    const wildcard = await agent.get('/api/events?search=%25').expect(200); // "%"

    expect(rock.body.data.map((e: { name: string }) => e.name)).toEqual(['Rock na Arena']);
    expect(rock.body.pagination.total).toBe(1);
    expect(wildcard.body.data).toEqual([]);
  });

  it.each(['page=0', 'page=abc', 'page=1.5', 'pageSize=51', 'pageSize=0'])('recusa paginação inválida (%s) com 400', async (query) => {
    const { app } = createTestContext();
    const agent = await loginAs(app, 'ana@exemplo.com');

    const res = await agent.get(`/api/events?${query}`).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('detalhe calcula disponibilidade: conta confirmadas e pendentes válidas, ignora o resto', async () => {
    const { app, db, clock } = createTestContext();
    const eventId = insertEvent(db, 'disp', '2026-12-01T20:00:00.000Z', 10);
    const in5min = new Date(START.getTime() + 5 * MINUTE).toISOString();

    insertReservation(db, eventId, 2, 'CONFIRMED', in5min);
    insertReservation(db, eventId, 3, 'PENDING', in5min); // válida até START + 5min
    insertReservation(db, eventId, 4, 'PENDING', START.toISOString()); // já vencida (expires_at = agora)
    insertReservation(db, eventId, 4, 'CANCELLED', in5min);
    insertReservation(db, eventId, 4, 'EXPIRED', in5min);
    const agent = await loginAs(app, 'ana@exemplo.com');

    const before = await agent.get(`/api/events/${eventId}`).expect(200);
    expect(before.body.data.available).toBe(10 - 2 - 3);

    clock.advance(5 * MINUTE); // a pendente de 3 vence: libera sem precisar de job
    const after = await agent.get(`/api/events/${eventId}`).expect(200);
    expect(after.body.data.available).toBe(10 - 2);
  });

  it('marca hasStarted quando a data do evento chega', async () => {
    const { app, db, clock } = createTestContext();
    const eventId = insertEvent(db, 'logo', new Date(START.getTime() + 10 * MINUTE).toISOString());
    const agent = await loginAs(app, 'ana@exemplo.com');

    expect((await agent.get(`/api/events/${eventId}`)).body.data.hasStarted).toBe(false);
    clock.advance(10 * MINUTE);
    expect((await agent.get(`/api/events/${eventId}`)).body.data.hasStarted).toBe(true);
  });

  it('evento inexistente responde 404; id inválido responde 400', async () => {
    const { app } = createTestContext();
    const agent = await loginAs(app, 'ana@exemplo.com');

    expect((await agent.get('/api/events/999').expect(404)).body.error.code).toBe('NOT_FOUND');
    await agent.get('/api/events/abc').expect(400);
  });
});
