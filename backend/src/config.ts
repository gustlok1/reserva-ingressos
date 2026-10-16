import 'dotenv/config';

// Configuração lida uma única vez do ambiente (.env), com valores padrão para desenvolvimento.
export const config = {
  port: Number(process.env.PORT ?? 3333),
  databasePath: process.env.DATABASE_PATH ?? './data/reservas.db',
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 8),
  reservationTtlSeconds: Number(process.env.RESERVATION_TTL_SECONDS ?? 300),
};
