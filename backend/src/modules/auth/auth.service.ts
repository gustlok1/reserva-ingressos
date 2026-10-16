import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Clock } from '../../lib/clock';
import { conflict, unauthorized } from '../../lib/errors';
import type { AuthRepository, Role } from './auth.repository';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

// Hash de uma senha qualquer, usado quando o e-mail não existe: o bcrypt.compare roda do mesmo jeito,
// então o tempo de resposta não revela se o e-mail está cadastrado.
const DUMMY_HASH = bcrypt.hashSync('senha-que-nao-existe', 10);

// Só o hash do token vai para o banco. O token em si existe apenas no cookie do usuário.
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function createAuthService(repository: AuthRepository, clock: Clock, sessionTtlHours: number) {
  // Cria a sessão no banco e devolve o token que vai para o cookie.
  function startSession(user: AuthUser) {
    const token = randomBytes(32).toString('base64url');
    const now = clock.now();
    const expiresAt = new Date(now.getTime() + sessionTtlHours * 60 * 60 * 1000);
    repository.createSession(hashToken(token), user.id, now.toISOString(), expiresAt.toISOString());
    return { token, expiresAt, user };
  }

  return {
    async login(email: string, password: string) {
      const user = repository.findUserByEmail(normalizeEmail(email));
      const passwordOk = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
      if (!user || !passwordOk) throw unauthorized('E-mail ou senha inválidos.');

      return startSession({ id: user.id, email: user.email, name: user.name, role: user.role });
    },

    // Cadastro (extra pós-entrega): cria o usuário com papel 'user' e já inicia a sessão.
    async register(input: { name: string; email: string; password: string }) {
      const email = normalizeEmail(input.email);
      if (repository.findUserByEmail(email)) throw conflict('EMAIL_TAKEN', 'Este e-mail já está cadastrado.');

      const passwordHash = await bcrypt.hash(input.password, 10);
      let id: number;
      try {
        id = repository.insertUser(email, input.name, passwordHash, clock.now().toISOString());
      } catch (error) {
        // Dois cadastros simultâneos com o mesmo e-mail: o UNIQUE do banco barra o segundo.
        if (String(error).includes('UNIQUE')) throw conflict('EMAIL_TAKEN', 'Este e-mail já está cadastrado.');
        throw error;
      }
      return startSession({ id, email, name: input.name, role: 'user' });
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
      return { id: session.user_id, email: session.email, name: session.name, role: session.role };
    },

    updateName(user: AuthUser, name: string): AuthUser {
      repository.updateName(user.id, name);
      return { ...user, name };
    },

    logout(token: string) {
      repository.deleteSession(hashToken(token));
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
