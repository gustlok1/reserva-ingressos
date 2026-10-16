import express from 'express';
import cookieParser from 'cookie-parser';
import type { Database } from './db/connection';
import type { Clock } from './lib/clock';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { createAuthRepository } from './modules/auth/auth.repository';
import { createAuthService } from './modules/auth/auth.service';
import { authRoutes } from './modules/auth/auth.routes';

export interface AppDeps {
  db: Database;
  clock: Clock;
  sessionTtlHours: number;
  reservationTtlSeconds: number;
}

// Monta o app a partir das dependências: o servidor passa o banco real e o relógio do sistema,
// os testes passam um banco isolado e um relógio controlado.
export function createApp({ db, clock, sessionTtlHours }: AppDeps) {
  const authService = createAuthService(createAuthRepository(db), clock, sessionTtlHours);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverTime: clock.now().toISOString() });
  });

  app.use('/api/auth', authRoutes(authService));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
