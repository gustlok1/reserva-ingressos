import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Database } from '../src/db/connection';
import { createTestContext, loginAs, START } from './helpers';

const ANA = 'ana@exemplo.com';
const BRUNO = 'bruno@exemplo.com';
const ROCK = 1; // capacidade 100, R$ 150,00
const CAMAROTE = 3; // capacidade 2, R$ 450,00
const TTL_MS = 300 * 1000;

type Agent = Awaited<ReturnType<typeof loginAs>>;

const available = async (agent: Agent, eventId: number) => (await agent.get(`/api/events/${eventId}`).expect(200)).body.data.available;

const dbReservations = (db: Database) =>
  db.prepare('SELECT id, user_id, quantity, status, total_cents FROM reservations ORDER BY id').all() as {
    id: number;
    user_id: number;
    quantity: number;
    status: string;
    total_cents: number;
  }[];

describe('cenário 1: criar, confirmar e confirmar de novo', () => {
  it('a mesma reserva é devolvida e a capacidade é consumida uma única vez', async () => {
    const { app, db } = createTestContext();
    const ana = await loginAs(app, ANA);

    const created = await ana.post('/api/reservations').send({ eventId: ROCK, quantity: 3 }).expect(201);
    expect(created.body.data).toMatchObject({
      status: 'PENDING',
      quantity: 3,
      unitPriceCents: 15000,
      totalCents: 45000,
      createdAt: START.toISOString(),
      expiresAt: new Date(START.getTime() + TTL_MS).toISOString(),
      event: { id: ROCK, name: 'Rock na Arena' },
    });
    expect(created.body.serverTime).toBe(START.toISOString());
    expect(await available(ana, ROCK)).toBe(97);

    const id = created.body.data.id;
    const first = await ana.post(`/api/reservations/${id}/confirm`).expect(200);
    const second = await ana.post(`/api/reservations/${id}/confirm`).expect(200);

    expect(first.body.data.status).toBe('CONFIRMED');
    expect(second.body.data).toEqual(first.body.data); // mesma reserva, mesmo total, mesmo confirmedAt
    expect(await available(ana, ROCK)).toBe(97); // não consumiu de novo

    // Persistência: uma única linha, CONFIRMED, com o total original.
    expect(dbReservations(db)).toEqual([{ id, user_id: 1, quantity: 3, status: 'CONFIRMED', total_cents: 45000 }]);
  });
});

describe('cenário 3: expiração', () => {
  it('um instante antes de expiresAt ainda é possível confirmar', async () => {
    const { app, clock } = createTestContext();
    const ana = await loginAs(app, ANA);
    const { id } = (await ana.post('/api/reservations').send({ eventId: CAMAROTE, quantity: 2 }).expect(201)).body.data;

    clock.advance(TTL_MS - 1);
    expect((await ana.post(`/api/reservations/${id}/confirm`).expect(200)).body.data.status).toBe('CONFIRMED');
  });

  it('no limite exato de expiresAt: aparece EXPIRADA, não confirma e libera os ingressos para outro usuário', async () => {
    const { app, db, clock } = createTestContext();
    const ana = await loginAs(app, ANA);
    const bruno = await loginAs(app, BRUNO);
    const { id } = (await ana.post('/api/reservations').send({ eventId: CAMAROTE, quantity: 2 }).expect(201)).body.data;
    await bruno.post('/api/reservations').send({ eventId: CAMAROTE, quantity: 1 }).expect(409); // esgotado

    clock.advance(TTL_MS); // agora === expiresAt

    expect((await ana.get(`/api/reservations/${id}`).expect(200)).body.data.status).toBe('EXPIRED');
    expect((await ana.get('/api/reservations').expect(200)).body.data[0].status).toBe('EXPIRED');

    const confirm = await ana.post(`/api/reservations/${id}/confirm`).expect(409);
    expect(confirm.body.error.code).toBe('RESERVATION_EXPIRED');
    expect(dbReservations(db)[0].status).toBe('EXPIRED'); // gravada sob demanda

    expect(await available(bruno, CAMAROTE)).toBe(2);
    await bruno.post('/api/reservations').send({ eventId: CAMAROTE, quantity: 2 }).expect(201);
  });

  it('depois de expiresAt também não pode cancelar, e o estado continua final', async () => {
    const { app, clock } = createTestContext();
    const ana = await loginAs(app, ANA);
    const { id } = (await ana.post('/api/reservations').send({ eventId: ROCK, quantity: 1 }).expect(201)).body.data;

    clock.advance(TTL_MS + 60_000);

    expect((await ana.post(`/api/reservations/${id}/cancel`).expect(409)).body.error.code).toBe('RESERVATION_EXPIRED');
    expect((await ana.post(`/api/reservations/${id}/confirm`).expect(409)).body.error.code).toBe('RESERVATION_EXPIRED');
    expect((await ana.get(`/api/reservations/${id}`).expect(200)).body.data.status).toBe('EXPIRED');
  });
});

describe('cenário 4: cancelamento', () => {
  it('cancelar libera a quantidade; repetir responde 409 sem liberar capacidade extra', async () => {
    const { app } = createTestContext();
    const ana = await loginAs(app, ANA);
    const { id } = (await ana.post('/api/reservations').send({ eventId: ROCK, quantity: 4 }).expect(201)).body.data;
    await ana.post('/api/reservations').send({ eventId: ROCK, quantity: 1 }).expect(201);
    expect(await available(ana, ROCK)).toBe(95);

    const cancelled = await ana.post(`/api/reservations/${id}/cancel`).expect(200);
    expect(cancelled.body.data).toMatchObject({ status: 'CANCELLED', cancelledAt: START.toISOString() });
    expect(await available(ana, ROCK)).toBe(99);

    const again = await ana.post(`/api/reservations/${id}/cancel`).expect(409);
    expect(again.body.error.code).toBe('INVALID_RESERVATION_STATE');
    expect(await available(ana, ROCK)).toBe(99);

    // Estado final: cancelada não volta a ser confirmável.
    await ana.post(`/api/reservations/${id}/confirm`).expect(409);
  });

  it('reserva confirmada não pode ser cancelada', async () => {
    const { app } = createTestContext();
    const ana = await loginAs(app, ANA);
    const { id } = (await ana.post('/api/reservations').send({ eventId: ROCK, quantity: 2 }).expect(201)).body.data;
    await ana.post(`/api/reservations/${id}/confirm`).expect(200);

    const res = await ana.post(`/api/reservations/${id}/cancel`).expect(409);
    expect(res.body.error.code).toBe('INVALID_RESERVATION_STATE');
    expect(await available(ana, ROCK)).toBe(98);
  });
});

describe('cenário 5: acesso', () => {
  it('sem autenticação, todas as rotas de reserva respondem 401', async () => {
    const { app } = createTestContext();

    await request(app).post('/api/reservations').send({ eventId: ROCK, quantity: 1 }).expect(401);
    await request(app).get('/api/reservations').expect(401);
    await request(app).get('/api/reservations/1').expect(401);
    await request(app).post('/api/reservations/1/confirm').expect(401);
    await request(app).post('/api/reservations/1/cancel').expect(401);
  });

  it('outro usuário não consulta, não confirma, não cancela e não vê a reserva na listagem', async () => {
    const { app, db } = createTestContext();
    const ana = await loginAs(app, ANA);
    const bruno = await loginAs(app, BRUNO);
    const { id } = (await ana.post('/api/reservations').send({ eventId: ROCK, quantity: 2 }).expect(201)).body.data;

    // 404, igual a uma reserva inexistente: não revela que a reserva existe nem seus dados.
    const notFoundBody = (await bruno.get('/api/reservations/9999').expect(404)).body;
    expect((await bruno.get(`/api/reservations/${id}`).expect(404)).body).toEqual(notFoundBody);
    await bruno.post(`/api/reservations/${id}/confirm`).expect(404);
    await bruno.post(`/api/reservations/${id}/cancel`).expect(404);
    expect((await bruno.get('/api/reservations').expect(200)).body.data).toEqual([]);

    // A reserva da Ana continua intacta.
    expect(dbReservations(db)[0].status).toBe('PENDING');
    expect((await ana.get('/api/reservations').expect(200)).body.data.map((r: { id: number }) => r.id)).toEqual([id]);
  });
});

describe('regras de criação', () => {
  it.each([
    ['quantidade zero', { eventId: ROCK, quantity: 0 }],
    ['quantidade fracionária', { eventId: ROCK, quantity: 1.5 }],
    ['quantidade acima de 4', { eventId: ROCK, quantity: 5 }],
    ['quantidade como texto', { eventId: ROCK, quantity: '2' }],
    ['sem quantidade', { eventId: ROCK }],
    ['eventId inválido', { eventId: 'abc', quantity: 1 }],
  ])('recusa %s com 400', async (_label, body) => {
    const { app, db } = createTestContext();
    const ana = await loginAs(app, ANA);

    const res = await ana.post('/api/reservations').send(body).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(dbReservations(db)).toEqual([]);
  });

  it('ignora preço, total, status e usuário enviados no payload', async () => {
    const { app } = createTestContext();
    const ana = await loginAs(app, ANA);

    const res = await ana
      .post('/api/reservations')
      .send({ eventId: ROCK, quantity: 2, userId: 2, unitPriceCents: 1, totalCents: 1, status: 'CONFIRMED', expiresAt: '2099-01-01T00:00:00.000Z' })
      .expect(201);

    expect(res.body.data).toMatchObject({ status: 'PENDING', unitPriceCents: 15000, totalCents: 30000 });
    expect(res.body.data.expiresAt).toBe(new Date(START.getTime() + TTL_MS).toISOString());
    expect((await ana.get('/api/reservations')).body.data).toHaveLength(1); // pertence à Ana, não ao usuário 2
  });

  it('evento inexistente responde 404', async () => {
    const { app } = createTestContext();
    const ana = await loginAs(app, ANA);
    expect((await ana.post('/api/reservations').send({ eventId: 999, quantity: 1 }).expect(404)).body.error.code).toBe('NOT_FOUND');
  });

  it('capacidade insuficiente responde 409', async () => {
    const { app } = createTestContext();
    const ana = await loginAs(app, ANA);
    await ana.post('/api/reservations').send({ eventId: CAMAROTE, quantity: 1 }).expect(201);

    const res = await ana.post('/api/reservations').send({ eventId: CAMAROTE, quantity: 2 }).expect(409);
    expect(res.body.error).toEqual({ code: 'INSUFFICIENT_AVAILABILITY', message: 'Ingressos insuficientes. Disponíveis: 1.' });
  });

  it('evento cujo horário de início já chegou responde 409', async () => {
    const { app, db, clock } = createTestContext();
    const { starts_at } = db.prepare('SELECT starts_at FROM events WHERE id = ?').get(ROCK) as { starts_at: string };
    clock.advance(new Date(starts_at).getTime() - START.getTime()); // exatamente no início
    const ana = await loginAs(app, ANA);

    const res = await ana.post('/api/reservations').send({ eventId: ROCK, quantity: 1 }).expect(409);
    expect(res.body.error.code).toBe('EVENT_STARTED');
  });
});
