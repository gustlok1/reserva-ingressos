import type { ReactNode } from 'react';
import { useMe } from '../api/hooks';
import { Alert, PageTitle } from './ui';

// Esconde as telas de admin de quem não é admin. É só conforto de interface:
// a proteção de verdade é a API, que responde 403 para usuários comuns.
export function AdminRoute({ children }: { children: ReactNode }) {
  const { data: user } = useMe();
  if (user?.role !== 'admin') {
    return (
      <>
        <PageTitle>Acesso restrito</PageTitle>
        <Alert kind="error">Esta área é só para administradores.</Alert>
      </>
    );
  }
  return children;
}
