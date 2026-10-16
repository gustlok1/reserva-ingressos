import { syncServerClock } from './server-clock';

// Erro padronizado da API: { error: { code, message, details? } }.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: { field: string; message: string }[];

  constructor(status: number, code: string, message: string, details?: { field: string; message: string }[]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    // URL absoluta a partir da origem da página: o Vite redireciona /api para o backend (proxy).
    response = await fetch(new URL(path, window.location.origin), {
      method: options.method ?? 'GET',
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'same-origin', // envia o cookie de sessão
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar ao servidor. Verifique sua conexão.');
  }

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    throw new ApiError(response.status, error?.code ?? 'UNKNOWN', error?.message ?? 'Erro inesperado.', error?.details);
  }

  if (typeof body?.serverTime === 'string') syncServerClock(body.serverTime);
  return body as T;
}

// Mensagem para exibir ao usuário: a da API quando existe, ou uma genérica.
export const errorMessage = (error: unknown) => (error instanceof ApiError ? error.message : 'Algo deu errado. Tente novamente.');
