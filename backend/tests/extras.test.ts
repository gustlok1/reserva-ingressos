import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestContext, loginAs, START } from './helpers';

// Testes das funcionalidades extras (pós-entrega): cadastro, perfil, admin de eventos e busca sem acento.

const DAY = 24 * 60 * 60 * 1000;
const future = (days: number) => new Date(START.getTime() + days * DAY).toISOString();

const validEvent = {
  name: 'Show de Teste',
  subtitle: 'Pista',
  venue: 'Arena Teste',
  startsAt: future(5),
  priceCents: 12000,
  capacity: 10,
  imageUrl: null,
};

describe('cadastro de usuário', () => {
  it('cria a conta, já abre a sessão e o papel é sempre "user"', async () => {
    const { app, db } = createTestContext();
    const agent = request.agent(app);

    const res = await agent
      .post('/api/auth/register')
      .send({ name: 'Carla Dias', email: 'Carla@Exemplo.com', password: 'senha-forte', role: 'admin' })
      .expect(201);

    expect(res.body.user).toMatchObject({ name: 'Carla Dias', email: 'carla@exemplo.com', role: 'user' });
    expect((await agent.get('/api/auth/me').expect(200)).body.user.email).toBe('carla@exemplo.com');

    const row = db.prepare('SELECT role, password_hash FROM users WHERE email = ?').get('carla@exemplo.com') as { role: string; password_hash: string };
    expect(row.role).toBe('user'); // o "role: admin" do payload foi ignorado
    expect(row.password_hash).not.toBe('senha-forte');

    // Consegue entrar depois com a senha cadastrada.
    await request(app).post('/api/auth/login').send({ email: 'carla@exemplo.com', password: 'senha-forte' }).expect(200);
  });

  it('e-mail já cadastrado responde 409; dados inválidos respondem 400', async () => {
    const { app } = createTestContext();

    const dup = await request(app).post('/api/auth/register').send({ name: 'Outra Ana', email: 'ANA@exemplo.com', password: 'senha-forte' }).expect(409);
    expect(dup.body.error.code).toBe('EMAIL_TAKEN');

    const invalid = await request(app).post('/api/auth/register').send({ name: 'X', email: 'nao-e-email', password: '123' }).expect(400);
    expect(invalid.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('perfil', () => {
  it('altera o próprio nome; exige login', async () => {
    const { app } = createTestContext();
    await request(app).patch('/api/auth/me').send({ name: 'Novo Nome' }).expect(401);

    const ana = await loginAs(app, 'ana@exemplo.com');
    const res = await ana.patch('/api/auth/me').send({ name: '  Ana Souza Lima  ', email: 'hacker@x.com', role: 'admin' }).expect(200);

    expect(res.body.user).toEqual({ id: 1, email: 'ana@exemplo.com', name: 'Ana Souza Lima', role: 'user' });
    expect((await ana.get('/api/auth/me')).body.user.name).toBe('Ana Souza Lima');
    await ana.patch('/api/auth/me').send({ name: '' }).expect(400);
  });
});

describe('admin de eventos', () => {
  it('sem login responde 401; usuário comum responde 403', async () => {
    const { app } = createTestContext();
    await request(app).post('/api/admin/events').send(validEvent).expect(401);

    const ana = await loginAs(app, 'ana@exemplo.com');
    expect((await ana.post('/api/admin/events').send(validEvent).expect(403)).body.error.code).toBe('FORBIDDEN');
    await ana.put('/api/admin/events/1').send(validEvent).expect(403);
  });

  it('admin cria um evento que aparece no catálogo público com a imagem padrão', async () => {
    const { app } = createTestContext();
    const admin = await loginAs(app, 'admin@exemplo.com');

    const created = await admin.post('/api/admin/events').send(validEvent).expect(201);
    expect(created.body.data).toMatchObject({ name: 'Show de Teste', available: 10, imageUrl: '/images/evento-padrao.jpg' });

    const list = await request(app).get('/api/events?search=show de teste').expect(200);
    expect(list.body.data.map((e: { id: number }) => e.id)).toEqual([created.body.data.id]);
  });

  it.each([
    ['data no passado', { startsAt: future(-1) }, 'INVALID_DATE'],
    ['preço fracionário', { priceCents: 10.5 }, 'VALIDATION_ERROR'],
    ['capacidade zero', { capacity: 0 }, 'VALIDATION_ERROR'],
    ['imagem com javascript:', { imageUrl: 'javascript:alert(1)' }, 'VALIDATION_ERROR'],
  ])('recusa %s com 400', async (_label, override, code) => {
    const { app } = createTestContext();
    const admin = await loginAs(app, 'admin@exemplo.com');

    const res = await admin.post('/api/admin/events').send({ ...validEvent, ...override }).expect(400);
    expect(res.body.error.code).toBe(code);
  });

  it('edição não deixa a capacidade abaixo do que já está vendido ou reservado', async () => {
    const { app } = createTestContext();
    const admin = await loginAs(app, 'admin@exemplo.com');
    const ana = await loginAs(app, 'ana@exemplo.com');
    const { id } = (await admin.post('/api/admin/events').send(validEvent).expect(201)).body.data;
    await ana.post('/api/reservations').send({ eventId: id, quantity: 3 }).expect(201);

    const tooSmall = await admin.put(`/api/admin/events/${id}`).send({ ...validEvent, capacity: 2 }).expect(409);
    expect(tooSmall.body.error.code).toBe('CAPACITY_BELOW_OCCUPIED');

    const ok = await admin.put(`/api/admin/events/${id}`).send({ ...validEvent, name: 'Show Renomeado', capacity: 3 }).expect(200);
    expect(ok.body.data).toMatchObject({ name: 'Show Renomeado', capacity: 3, available: 0 });

    await admin.put('/api/admin/events/999').send(validEvent).expect(404);
  });

  it('mudar o preço não altera reservas já feitas', async () => {
    const { app } = createTestContext();
    const admin = await loginAs(app, 'admin@exemplo.com');
    const ana = await loginAs(app, 'ana@exemplo.com');
    const { id } = (await admin.post('/api/admin/events').send(validEvent).expect(201)).body.data;
    const reservation = (await ana.post('/api/reservations').send({ eventId: id, quantity: 2 }).expect(201)).body.data;

    await admin.put(`/api/admin/events/${id}`).send({ ...validEvent, priceCents: 99900 }).expect(200);

    const after = (await ana.get(`/api/reservations/${reservation.id}`).expect(200)).body.data;
    expect(after).toMatchObject({ unitPriceCents: 12000, totalCents: 24000 });
  });
});

describe('busca sem acento', () => {
  it('"eletronica" e "ELETRÔNICA" encontram "Noite Eletrônica"', async () => {
    const { app } = createTestContext();

    for (const term of ['eletronica', 'ELETRÔNICA']) {
      const res = await request(app).get(`/api/events?search=${encodeURIComponent(term)}`).expect(200);
      expect(res.body.data.map((e: { name: string }) => e.name)).toEqual(['Camarote VIP - Noite Eletrônica']);
    }
  });
});
