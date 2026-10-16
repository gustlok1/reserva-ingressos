import type { Database } from '../../db/connection';

export type Role = 'user' | 'admin';

export interface UserRow {
  id: number;
  email: string;
  name: string;
  role: Role;
  password_hash: string;
}

export interface SessionUserRow {
  user_id: number;
  email: string;
  name: string;
  role: Role;
  expires_at: string;
}

export function createAuthRepository(db: Database) {
  return {
    findUserByEmail(email: string) {
      return db.prepare('SELECT id, email, name, role, password_hash FROM users WHERE email = ?').get(email) as UserRow | undefined;
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
          `SELECT s.user_id, s.expires_at, u.email, u.name, u.role
           FROM sessions s
           JOIN users u ON u.id = s.user_id
           WHERE s.token_hash = ?`,
        )
        .get(tokenHash) as SessionUserRow | undefined;
    },

    // Cadastro sempre cria papel 'user': o papel nunca vem da requisição.
    insertUser(email: string, name: string, passwordHash: string, createdAt: string) {
      const result = db
        .prepare(`INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?, ?, ?, 'user', ?)`)
        .run(email, name, passwordHash, createdAt);
      return Number(result.lastInsertRowid);
    },

    updateName(userId: number, name: string) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, userId);
    },

    deleteSession(tokenHash: string) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
