import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { DEMO_PASSWORD } from '../src/db/seed';
import { hashToken } from '../src/modules/auth/auth.service';
import { createTestContext, loginAs } from './helpers';

const ANA = 'ana@exemplo.com';

function sessionCookie(setCookie: string[] | string | undefined) {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
  return cookies.find((cookie) => cookie.startsWith('session=')) ?? '';
}

describe('autenticação', () => {
  it('login válido devolve o usuário (sem hash de senha) e um cookie httpOnly', async () => {
    const { app, db } = createTestContext();

    const res = await request(app).post('/api/auth/login').send({ email: ANA, password: DEMO_PASSWORD }).expect(200);

    expect(res.body.user).toEqual({ id: 1, email: ANA, name: 'Ana Souza', role: 'user' });
    expect(JSON.stringify(res.body)).not.toContain('password');

    const cookie = sessionCookie(res.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    // O banco guarda o hash do token, nunca o token em si.
    const token = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
    const stored = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
    expect(stored).toEqual([{ token_hash: hashToken(token) }]);
  });

  it('senha errada e e-mail inexistente recebem o mesmo 401', async () => {
    const { app } = createTestContext();

    const wrongPassword = await request(app).post('/api/auth/login').send({ email: ANA, password: 'errada' }).expect(401);
    const unknownEmail = await request(app).post('/api/auth/login').send({ email: 'nao@existe.com', password: 'x' }).expect(401);

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe('UNAUTHORIZED');
  });

  it('corpo inválido responde 400 com detalhes por campo', async () => {
    const { app } = createTestContext();

    const res = await request(app).post('/api/auth/login').send({ email: 'nao-e-email' }).expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['email', 'password']);
  });

  it('JSON malformado responde 400 sem stack trace', async () => {
    const { app } = createTestContext();

    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400);

    expect(res.body).toEqual({ error: { code: 'INVALID_JSON', message: expect.any(String) } });
  });

  it('/me sem sessão responde 401; com sessão devolve o usuário', async () => {
    const { app } = createTestContext();

    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Cookie', 'session=token-inventado').expect(401);

    const agent = await loginAs(app, ANA);
    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body.user.email).toBe(ANA);
  });

  it('logout apaga a sessão no banco e o mesmo cookie deixa de funcionar', async () => {
    const { app, db } = createTestContext();
    const login = await request(app).post('/api/auth/login').send({ email: ANA, password: DEMO_PASSWORD }).expect(200);
    const cookie = sessionCookie(login.headers['set-cookie']).split(';')[0];

    await request(app).post('/api/auth/logout').set('Cookie', cookie).expect(204);

    // Reaproveitar o cookie antigo (ex.: copiado antes do logout) não funciona mais.
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
    expect((db.prepare('SELECT COUNT(*) AS total FROM sessions').get() as { total: number }).total).toBe(0);
  });

  it('sessão expira após o TTL (8h), controlando o relógio', async () => {
    const { app, clock } = createTestContext();
    const agent = await loginAs(app, ANA);

    clock.advance(8 * 60 * 60 * 1000 - 1);
    await agent.get('/api/auth/me').expect(200);

    clock.advance(1); // exatamente no limite: já expirou
    await agent.get('/api/auth/me').expect(401);
  });

  it('rota inexistente da API responde 404 no formato padrão', async () => {
    const { app } = createTestContext();

    const res = await request(app).get('/api/nao-existe').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
