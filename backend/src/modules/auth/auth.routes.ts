import { Router, type CookieOptions } from 'express';
import { z } from 'zod';
import { SESSION_COOKIE, currentUser, requireAuth } from '../../http/require-auth';
import type { AuthService } from './auth.service';

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript da página não consegue ler o token (protege contra XSS roubando a sessão)
  sameSite: 'lax', // o navegador não envia o cookie em POSTs vindos de outros sites (protege contra CSRF)
  secure: process.env.NODE_ENV === 'production', // em produção, só via HTTPS
  path: '/',
};

export function authRoutes(authService: AuthService) {
  const router = Router();

  router.post('/login', async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const { token, expiresAt, user } = await authService.login(email, password);

    res.cookie(SESSION_COOKIE, token, { ...cookieOptions, expires: expiresAt });
    res.json({ user, expiresAt: expiresAt.toISOString() });
  });

  router.post('/logout', (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    if (typeof token === 'string') authService.logout(token);

    res.clearCookie(SESSION_COOKIE, cookieOptions);
    res.status(204).end();
  });

  router.get('/me', requireAuth(authService), (_req, res) => {
    res.json({ user: currentUser(res) });
  });

  return router;
}
