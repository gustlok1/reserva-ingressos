import { config } from './config';
import { createApp } from './app';
import { openDatabase } from './db/connection';
import { systemClock } from './lib/clock';

const db = openDatabase(config.databasePath);
const app = createApp({
  db,
  clock: systemClock,
  sessionTtlHours: config.sessionTtlHours,
  reservationTtlSeconds: config.reservationTtlSeconds,
});

app.listen(config.port, () => console.log(`API rodando em http://localhost:${config.port}`));
