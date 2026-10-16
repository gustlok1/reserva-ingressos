import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from '../lib/errors';
import type { AuthService, AuthUser } from '../modules/auth/auth.service';

export const SESSION_COOKIE = 'session';

// Middleware das rotas protegidas: sem sessão válida, responde 401.
// A identidade vem só daqui; nunca de um userId enviado no corpo da requisição.
export function requireAuth(authService: AuthService): RequestHandler {
  return (req, res, next) => {
    const token = req.cookies?.[SESSION_COOKIE];
    const user = typeof token === 'string' ? authService.authenticate(token) : null;
    if (!user) throw unauthorized();

    res.locals.user = user;
    next();
  };
}

// Rotas de administração: exige sessão válida (401) e papel 'admin' (403).
export function requireAdmin(authService: AuthService): RequestHandler {
  const authenticate = requireAuth(authService);
  return (req, res, next) => {
    authenticate(req, res, () => {
      if (currentUser(res).role !== 'admin') throw forbidden();
      next();
    });
  };
}

// Leitura tipada do usuário autenticado dentro dos handlers.
export function currentUser(res: { locals: Record<string, unknown> }): AuthUser {
  return res.locals.user as AuthUser;
}
