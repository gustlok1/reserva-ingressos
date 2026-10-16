import { rmSync } from 'node:fs';
import { config } from '../config';
import { openDatabase } from '../db/connection';
import { runMigrations } from '../db/migrate';
import { DEMO_PASSWORD, seed } from '../db/seed';

// Uso: tsx src/scripts/db.ts <migrate|seed|setup|reset>
const command = process.argv[2];
const path = config.databasePath;

if (command === 'reset') {
  // Apaga o arquivo do banco e os arquivos auxiliares do modo WAL.
  for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true });
  console.log(`Banco removido: ${path}`);
}

const db = openDatabase(path);

if (['migrate', 'setup', 'reset'].includes(command)) {
  const applied = runMigrations(db);
  console.log(applied.length ? `Migrations aplicadas: ${applied.join(', ')}` : 'Nenhuma migration pendente.');
}

if (['seed', 'setup', 'reset'].includes(command)) {
  const { usersInserted, eventsInserted } = seed(db);
  console.log(`Seed: ${usersInserted} usuário(s) e ${eventsInserted} evento(s) inseridos. Senha das contas demo: ${DEMO_PASSWORD}`);
}

if (!['migrate', 'seed', 'setup', 'reset'].includes(command)) {
  console.error('Comando inválido. Use: migrate | seed | setup | reset');
  process.exitCode = 1;
}

db.close();
