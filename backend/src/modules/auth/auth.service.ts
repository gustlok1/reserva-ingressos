import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Clock } from '../../lib/clock';
import { unauthorized } from '../../lib/errors';
import type { AuthRepository } from './auth.repository';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

// Hash de uma senha qualquer, usado quando o e-mail não existe: o bcrypt.compare roda do mesmo jeito,
// então o tempo de resposta não revela se o e-mail está cadastrado.
const DUMMY_HASH = bcrypt.hashSync('senha-que-nao-existe', 10);

// Só o hash do token vai para o banco. O token em si existe apenas no cookie do usuário.
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function createAuthService(repository: AuthRepository, clock: Clock, sessionTtlHours: number) {
  return {
    async login(email: string, password: string) {
      const user = repository.findUserByEmail(email.trim().toLowerCase());
      const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
      if (!user || !passwordOk) throw unauthorized('E-mail ou senha inválidos.');

      const token = randomBytes(32).toString('base64url');
      const now = clock.now();
      const expiresAt = new Date(now.getTime() + sessionTtlHours * 60 * 60 * 1000);
      repository.createSession(hashToken(token), user.id, now.toISOString(), expiresAt.toISOString());

      const authUser: AuthUser = { id: user.id, email: user.email, name: user.name };
      return { token, expiresAt, user: authUser };
    },

    // Devolve o usuário dono do token, ou null se o token não existe ou a sessão expirou.
    authenticate(token: string): AuthUser | null {
      const tokenHash = hashToken(token);
      const session = repository.findSessionUser(tokenHash);
      if (!session) return null;

      if (clock.now().toISOString() >= session.expires_at) {
        repository.deleteSession(tokenHash); // limpa a sessão vencida
        return null;
      }
      return { id: session.user_id, email: session.email, name: session.name };
    },

    logout(token: string) {
      repository.deleteSession(hashToken(token));
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
