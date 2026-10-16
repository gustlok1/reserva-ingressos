import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
import { errorMessage } from '../api/client';
import type { ReservationStatus } from '../api/types';
import { STATUS_LABEL } from '../lib/format';

// Componentes visuais pequenos, inspirados nos primitivos do design system (PageTitle, botões, campos).

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="page-title">{children}</h1>;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
  loading?: boolean;
}

// `loading` desabilita o botão (evita clique duplo) e avisa leitores de tela com aria-busy.
export function Button({ variant = 'primary', loading = false, disabled, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={`button button--${variant}`} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading && <LoaderCircle size={16} className="spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  // role="alert" é anunciado na hora por leitores de tela; "status" é anunciado sem interromper.
  return (
    <div className={`alert alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <p className="state" role="status">
      {label}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="state">{children}</p>;
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = errorMessage(error);
  return (
    <div className="state">
      <Alert kind="error">{message}</Alert>
      {onRetry && (
        <p>
          <Button variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        </p>
      )}
    </div>
  );
}

export function StatusBadge({ status }: { status: ReservationStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABEL[status]}</span>;
}
