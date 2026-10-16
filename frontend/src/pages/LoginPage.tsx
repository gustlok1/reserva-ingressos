import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api/client';
import { useLogin, useMe } from '../api/hooks';
import { Alert, Button, PageTitle } from '../components/ui';

export function LoginPage() {
  const me = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/events';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (me.data) return <Navigate to={from} replace />;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) });
  };

  return (
    <form className="login panel" onSubmit={handleSubmit} noValidate>
      <PageTitle>Entrar</PageTitle>

      {login.isError && <Alert kind="error">{errorMessage(login.error)}</Alert>}

      <label className="field">
        <span className="field__label">E-mail</span>
        <input
          className="input"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
        />
      </label>

      <label className="field">
        <span className="field__label">Senha</span>
        <input
          className="input"
          type="password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      <Button type="submit" loading={login.isPending} disabled={!email || !password}>
        Entrar
      </Button>

      <p>
        Ainda não tem conta?{' '}
        <Link to="/register" state={location.state}>
          Cadastre-se
        </Link>
      </p>

      <p className="muted">Contas de demonstração: ana@exemplo.com, bruno@exemplo.com ou admin@exemplo.com, senha senha123.</p>
    </form>
  );
}
