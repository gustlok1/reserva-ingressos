import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { ApiError, errorMessage } from '../api/client';
import { useMe, useRegister } from '../api/hooks';
import { Alert, Button, PageTitle } from '../components/ui';

export function RegisterPage() {
  const me = useMe();
  const register = useRegister();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/events';

  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [localError, setLocalError] = useState<string | null>(null);

  if (me.data) return <Navigate to={from} replace />;

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value });

  // Erros de validação da API vêm por campo (details); mostramos cada um embaixo do seu input.
  const fieldErrors = new Map(
    register.error instanceof ApiError ? (register.error.details ?? []).map((d) => [d.field, d.message] as const) : [],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      setLocalError('As senhas não conferem.');
      return;
    }
    setLocalError(null);
    register.mutate({ name: form.name, email: form.email, password: form.password }, { onSuccess: () => navigate(from, { replace: true }) });
  };

  const field = (name: 'name' | 'email' | 'password', label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="input"
        name={name}
        required
        value={form[name]}
        onChange={set(name)}
        aria-invalid={fieldErrors.has(name)}
        aria-describedby={fieldErrors.has(name) ? `${name}-erro` : undefined}
        {...props}
      />
      {fieldErrors.has(name) && (
        <span id={`${name}-erro`} className="field__error">
          {fieldErrors.get(name)}
        </span>
      )}
    </label>
  );

  return (
    <form className="login panel" onSubmit={handleSubmit} noValidate>
      <PageTitle>Cadastro</PageTitle>

      {localError && <Alert kind="error">{localError}</Alert>}
      {register.isError && fieldErrors.size === 0 && <Alert kind="error">{errorMessage(register.error)}</Alert>}

      {field('name', 'Nome completo', { autoComplete: 'name' })}
      {field('email', 'E-mail', { type: 'email', autoComplete: 'email', placeholder: 'voce@exemplo.com' })}
      {field('password', 'Senha (mínimo 8 caracteres)', { type: 'password', autoComplete: 'new-password' })}

      <label className="field">
        <span className="field__label">Confirmar senha</span>
        <input className="input" type="password" name="confirm" required value={form.confirm} onChange={set('confirm')} autoComplete="new-password" />
      </label>

      <Button type="submit" loading={register.isPending} disabled={!form.name || !form.email || !form.password || !form.confirm}>
        Criar conta
      </Button>

      <p>
        Já tem conta?{' '}
        <Link to="/login" state={location.state}>
          Entrar
        </Link>
      </p>
    </form>
  );
}
