import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useMe } from '../api/hooks';
import { ErrorState, LoadingState } from './ui';

// Só renderiza o conteúdo com usuário logado. Sem sessão, manda para o login
// guardando a página de origem para voltar depois de entrar.
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) return <LoadingState label="Verificando sessão..." />;
  if (me.isError) return <ErrorState error={me.error} onRetry={() => me.refetch()} />;
  if (!me.data) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}
