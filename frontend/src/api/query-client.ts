import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './client';

export const ME_KEY = ['me'] as const;

export function createQueryClient() {
  // Qualquer 401 (sessão expirada ou logout em outra aba) marca o usuário como deslogado.
  // O <ProtectedRoute> reage a isso e manda para o login.
  const onError = (error: Error) => {
    if (error instanceof ApiError && error.status === 401) queryClient.setQueryData(ME_KEY, null);
  };

  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        // Erros 4xx são respostas definitivas da API (não adianta repetir); só tenta de novo falhas de rede/5xx.
        retry: (failureCount, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 2,
        refetchOnWindowFocus: true,
      },
    },
  });
  return queryClient;
}
