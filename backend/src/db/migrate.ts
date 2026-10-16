import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { transaction, type Database } from './connection';

const MIGRATIONS_DIR = fileURLToPath(new URL('./migrations/', import.meta.url));

/**
 * Aplica, em ordem alfabética, os arquivos .sql de migrations/ que ainda não rodaram.
 * A tabela schema_migrations registra o que já foi aplicado, então rodar de novo não faz nada.
 * Cada migration roda em uma transação: se falhar no meio, nada dela fica no banco.
 */
export function runMigrations(db: Database): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const rows = db.prepare('SELECT name FROM schema_migrations').all() as { name: string }[];
  const applied = new Set(rows.map((row) => row.name));

  const pending = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql') && !applied.has(file))
    .sort();

  for (const file of pending) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    transaction(db, () => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString());
    });
  }

  return pending;
}
