import { useState, type FormEvent } from 'react';
import { errorMessage } from '../api/client';
import { useMe, useReservations, useUpdateMe } from '../api/hooks';
import { Alert, Button, PageTitle } from '../components/ui';
import { formatMoney } from '../lib/format';

export function ProfilePage() {
  const { data: user } = useMe();
  const reservations = useReservations();
  const updateMe = useUpdateMe();
  const [name, setName] = useState(user?.name ?? '');

  if (!user) return null;

  const list = reservations.data ?? [];
  const confirmed = list.filter((r) => r.status === 'CONFIRMED');
  const pending = list.filter((r) => r.status === 'PENDING');
  const spent = confirmed.reduce((sum, r) => sum + r.totalCents, 0);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    updateMe.mutate({ name });
  };

  return (
    <>
      <PageTitle>Perfil</PageTitle>

      <div className="stats" aria-busy={reservations.isPending}>
        <div className="stat">
          <span className="stat__value">{confirmed.length}</span>
          <span className="muted">Compras confirmadas</span>
        </div>
        <div className="stat">
          <span className="stat__value">{pending.length}</span>
          <span className="muted">Reservas pendentes</span>
        </div>
        <div className="stat">
          <span className="stat__value">{formatMoney(spent)}</span>
          <span className="muted">Total em compras</span>
        </div>
      </div>

      <form className="panel" onSubmit={handleSubmit} style={{ display: 'grid', gap: 'var(--space-5)' }}>
        {updateMe.isSuccess && <Alert kind="success">Dados atualizados.</Alert>}
        {updateMe.isError && <Alert kind="error">{errorMessage(updateMe.error)}</Alert>}

        <label className="field">
          <span className="field__label">Nome completo</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        </label>

        <label className="field">
          <span className="field__label">E-mail</span>
          {/* O e-mail é o login: não é editável por aqui. */}
          <input className="input" value={user.email} disabled />
        </label>

        <div>
          <Button type="submit" loading={updateMe.isPending} disabled={name.trim() === user.name || name.trim().length < 2}>
            Salvar alterações
          </Button>
        </div>
      </form>
    </>
  );
}
