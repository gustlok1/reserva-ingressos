import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export type Database = DatabaseSync;

export function openDatabase(path: string): Database {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });

  const db = new DatabaseSync(path);
  // WAL: leituras não bloqueiam escritas (e vice-versa), melhor para várias instâncias no mesmo arquivo.
  db.exec('PRAGMA journal_mode = WAL');
  // SQLite só aplica FOREIGN KEY se isto estiver ligado, e vale por conexão.
  db.exec('PRAGMA foreign_keys = ON');
  // Se outra conexão estiver escrevendo, espera até 5s pelo lock em vez de falhar na hora com SQLITE_BUSY.
  db.exec('PRAGMA busy_timeout = 5000');
  // Função SQL própria para busca sem acento e sem diferenciar maiúsculas: unaccent('Eletrônica') = 'eletronica'.
  // O LIKE do SQLite só ignora maiúsculas em letras sem acento, por isso a normalização é feita aqui em JS.
  db.function('unaccent', { deterministic: true }, (value) =>
    value == null ? null : String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
  );
  return db;
}

/**
 * Executa `fn` dentro de uma transação.
 *
 * IMMEDIATE pega o lock de escrita do arquivo já no BEGIN: nenhuma outra conexão
 * (nem de outro processo) consegue escrever até o COMMIT/ROLLBACK. É isso que torna
 * "ler o saldo e gravar a reserva" uma operação atômica sob concorrência.
 */
export function transaction<T>(db: Database, fn: () => T, mode: 'IMMEDIATE' | 'DEFERRED' = 'IMMEDIATE'): T {
  db.exec(`BEGIN ${mode}`);
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
