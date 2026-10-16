import express from 'express';
import cookieParser from 'cookie-parser';
import type { Database } from './db/connection';
import type { Clock } from './lib/clock';
import { errorHandler, notFoundHandler } from './http/error-handler';
import { createAuthRepository } from './modules/auth/auth.repository';
import { createAuthService } from './modules/auth/auth.service';
import { authRoutes } from './modules/auth/auth.routes';
import { requireAdmin, requireAuth } from './http/require-auth';
import { createEventsRepository } from './modules/events/events.repository';
import { createEventsService } from './modules/events/events.service';
import { eventsRoutes } from './modules/events/events.routes';
import { adminEventsRoutes } from './modules/events/events.admin.routes';
import { createReservationsRepository } from './modules/reservations/reservations.repository';
import { createReservationsService } from './modules/reservations/reservations.service';
import { reservationsRoutes } from './modules/reservations/reservations.routes';

export interface AppDeps {
  db: Database;
  clock: Clock;
  sessionTtlHours: number;
  reservationTtlSeconds: number;
}

// Monta o app a partir das dependências: o servidor passa o banco real e o relógio do sistema,
// os testes passam um banco isolado e um relógio controlado.
export function createApp({ db, clock, sessionTtlHours, reservationTtlSeconds }: AppDeps) {
  const authService = createAuthService(createAuthRepository(db), clock, sessionTtlHours);
  const eventsRepository = createEventsRepository(db);
  const eventsService = createEventsService(eventsRepository, clock, db);
  const reservationsService = createReservationsService({
    db,
    reservations: createReservationsRepository(db),
    events: eventsRepository,
    clock,
    ttlSeconds: reservationTtlSeconds,
  });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', serverTime: clock.now().toISOString() });
  });

  app.use('/api/auth', authRoutes(authService));
  // Catálogo público (extra pós-entrega): qualquer visitante vê os eventos; reservar exige login.
  app.use('/api/events', eventsRoutes(eventsService));
  app.use('/api/reservations', requireAuth(authService), reservationsRoutes(reservationsService, clock));
  app.use('/api/admin/events', requireAdmin(authService), adminEventsRoutes(eventsService));

  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return app;
}
