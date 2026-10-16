import request from 'supertest';
import { createApp } from '../src/app';
import { openDatabase } from '../src/db/connection';
import { runMigrations } from '../src/db/migrate';
import { DEMO_PASSWORD, seed } from '../src/db/seed';
import type { Clock } from '../src/lib/clock';

export const START = new Date('2026-10-16T12:00:00.000Z');

// Relógio de teste: parado em `start` até alguém chamar advance().
export function createTestClock(start = START) {
  let current = start.getTime();
  return {
    now: () => new Date(current),
    advance(ms: number) {
      current += ms;
    },
  } satisfies Clock & { advance(ms: number): void };
}

// App completo com banco em memória (isolado por teste), migrations e seed já aplicados.
export function createTestContext({ path = ':memory:' } = {}) {
  const db = openDatabase(path);
  runMigrations(db);
  seed(db, START);

  const clock = createTestClock();
  const app = createApp({ db, clock, sessionTtlHours: 8, reservationTtlSeconds: 300 });
  return { db, clock, app };
}

// Faz login e devolve um "agent" do supertest, que guarda o cookie entre as requisições.
export async function loginAs(app: ReturnType<typeof createApp>, email: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email, password: DEMO_PASSWORD }).expect(200);
  return agent;
}
