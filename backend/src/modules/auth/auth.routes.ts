import { Router, type CookieOptions, type Response } from 'express';
import { z } from 'zod';
import { SESSION_COOKIE, currentUser, requireAuth } from '../../http/require-auth';
import type { AuthService } from './auth.service';

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Informe a senha.'),
});

const nameSchema = z.string().trim().min(2, 'Informe seu nome.').max(80, 'Nome muito longo.');

// Campos extras (ex.: "role": "admin") são descartados pelo Zod: ninguém se cadastra como admin.
const registerSchema = z.object({
  name: nameSchema,
  email: z.email('Informe um e-mail válido.').max(120),
  // bcrypt só considera os primeiros 72 bytes da senha, por isso o limite.
  password: z.string().min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72, 'Senha muito longa.'),
});

const updateMeSchema = z.object({ name: nameSchema });

const cookieOptions: CookieOptions = {
  httpOnly: true, // JavaScript da página não consegue ler o token (protege contra XSS roubando a sessão)
  sameSite: 'lax', // o navegador não envia o cookie em POSTs vindos de outros sites (protege contra CSRF)
  secure: process.env.NODE_ENV === 'production', // em produção, só via HTTPS
  path: '/',
};

export function authRoutes(authService: AuthService) {
  const router = Router();

  const sendSession = (res: Response, status: number, session: Awaited<ReturnType<AuthService['login']>>) => {
    res.cookie(SESSION_COOKIE, session.token, { ...cookieOptions, expires: session.expiresAt });
    res.status(status).json({ user: session.user, expiresAt: session.expiresAt.toISOString() });
  };

  router.post('/login', async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    sendSession(res, 200, await authService.login(email, password));
  });

  router.post('/register', async (req, res) => {
    sendSession(res, 201, await authService.register(registerSchema.parse(req.body)));
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

  // Perfil: o usuário só altera o próprio nome. E-mail e papel não são editáveis por aqui.
  router.patch('/me', requireAuth(authService), (req, res) => {
    const { name } = updateMeSchema.parse(req.body);
    res.json({ user: authService.updateName(currentUser(res), name) });
  });

  return router;
}
