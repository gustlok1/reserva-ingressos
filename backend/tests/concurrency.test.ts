import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { openDatabase, type Database } from '../src/db/connection';
import { runMigrations } from '../src/db/migrate';
import { DEMO_PASSWORD, seed } from '../src/db/seed';
import { createTestClock, loginAs, tempDatabasePath } from './helpers';

const CAMAROTE = 3; // capacidade 2
const BACKEND_DIR = fileURLToPath(new URL('..', import.meta.url));

function prepareDatabase(path: string) {
  const db = openDatabase(path);
  runMigrations(db);
  seed(db);
  return db;
}

function insertEvent(db: Database, slug: string, capacity: number) {
  const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const result = db
    .prepare(`INSERT INTO events (slug, name, venue, starts_at, price_cents, capacity, created_at) VALUES (?, ?, 'Local', ?, 1000, ?, ?)`)
    .run(slug, slug, startsAt, capacity, new Date().toISOString());
  return Number(result.lastInsertRowid);
}

const reservationTotals = (db: Database, eventId: number) =>
  db.prepare(`SELECT COUNT(*) AS rows, COALESCE(SUM(quantity), 0) AS tickets FROM reservations WHERE event_id = ?`).get(eventId) as {
    rows: number;
    tickets: number;
  };

describe('cenário 2: concorrência (mesmo processo, duas instâncias do app)', () => {
  it('duas reservas simultâneas de 2 ingressos com capacidade 2: um 201 e um 409', async () => {
    const path = tempDatabasePath();
    const db = prepareDatabase(path);
    // Duas instâncias do app, cada uma com a sua conexão ao mesmo arquivo.
    const deps = { clock: createTestClock(new Date()), sessionTtlHours: 8, reservationTtlSeconds: 300 };
    const appA = createApp({ db: openDatabase(path), ...deps });
    const appB = createApp({ db: openDatabase(path), ...deps });
    const ana = await loginAs(appA, 'ana@exemplo.com');
    const bruno = await loginAs(appB, 'bruno@exemplo.com');

    const responses = await Promise.all([
      ana.post('/api/reservations').send({ eventId: CAMAROTE, quantity: 2 }),
      bruno.post('/api/reservations').send({ eventId: CAMAROTE, quantity: 2 }),
    ]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(responses.find((r) => r.status === 409)!.body.error.code).toBe('INSUFFICIENT_AVAILABILITY');
    expect(reservationTotals(db, CAMAROTE)).toEqual({ rows: 1, tickets: 2 });
    expect((await ana.get(`/api/events/${CAMAROTE}`)).body.data.available).toBe(0);
  });
});

/**
 * O teste acima roda num único processo, onde o Node executa uma requisição de cada vez.
 * Este sobe dois servidores de verdade, em processos separados, apontando para o mesmo
 * arquivo SQLite. As requisições rodam em paralelo de fato, e só o lock do banco
 * (BEGIN IMMEDIATE) impede a venda acima da capacidade.
 */
describe('cenário 2: concorrência entre dois processos do backend', () => {
  const path = tempDatabasePath();
  const servers: ChildProcess[] = [];
  const ports = [43101, 43102];
  let db: Database;

  function startServer(port: number) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
        cwd: BACKEND_DIR,
        env: { ...process.env, PORT: String(port), DATABASE_PATH: path, NODE_NO_WARNINGS: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      servers.push(child);
      child.stdout!.on('data', (chunk) => String(chunk).includes('API rodando') && resolve());
      child.on('exit', (code) => reject(new Error(`servidor na porta ${port} saiu com código ${code}`)));
    });
  }

  async function login(port: number, email: string) {
    const res = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: DEMO_PASSWORD }),
    });
    return res.headers.getSetCookie()[0].split(';')[0];
  }

  const reserve = (port: number, cookie: string, eventId: number, quantity: number) =>
    fetch(`http://localhost:${port}/api/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ eventId, quantity }),
    }).then((res) => res.status);

  beforeAll(async () => {
    db = prepareDatabase(path);
    await Promise.all(ports.map(startServer));
  }, 30_000);

  afterAll(() => servers.forEach((server) => server.kill()));

  it('Ana na instância A e Bruno na B, ao mesmo tempo: um 201 e um 409', async () => {
    const [anaCookie, brunoCookie] = await Promise.all([login(ports[0], 'ana@exemplo.com'), login(ports[1], 'bruno@exemplo.com')]);

    const statuses = await Promise.all([reserve(ports[0], anaCookie, CAMAROTE, 2), reserve(ports[1], brunoCookie, CAMAROTE, 2)]);

    expect(statuses.sort()).toEqual([201, 409]);
    expect(reservationTotals(db, CAMAROTE)).toEqual({ rows: 1, tickets: 2 });
  });

  it('40 requisições simultâneas de 1 ingresso, divididas entre as instâncias, num evento de capacidade 5: exatamente 5 sucessos', async () => {
    const eventId = insertEvent(db, 'stress', 5);
    const cookies = await Promise.all(ports.map((port) => login(port, 'ana@exemplo.com')));

    const statuses = await Promise.all(Array.from({ length: 40 }, (_, i) => reserve(ports[i % 2], cookies[i % 2], eventId, 1)));

    expect(statuses.filter((s) => s === 201)).toHaveLength(5);
    expect(statuses.filter((s) => s === 409)).toHaveLength(35);
    expect(reservationTotals(db, eventId)).toEqual({ rows: 5, tickets: 5 });
  });
});
