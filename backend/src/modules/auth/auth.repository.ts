import type { Database } from '../../db/connection';

export interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
}

export interface SessionUserRow {
  user_id: number;
  email: string;
  name: string;
  expires_at: string;
}

export function createAuthRepository(db: Database) {
  return {
    findUserByEmail(email: string) {
      return db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(email) as UserRow | undefined;
    },

    createSession(tokenHash: string, userId: number, createdAt: string, expiresAt: string) {
      db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
        tokenHash,
        userId,
        createdAt,
        expiresAt,
      );
    },

    findSessionUser(tokenHash: string) {
      return db
        .prepare(
          `SELECT s.user_id, s.expires_at, u.email, u.name
           FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ?`,
        )
        .get(tokenHash) as SessionUserRow | undefined;
    },

    deleteSession(tokenHash: string) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
