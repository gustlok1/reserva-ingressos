// Erro de negócio com status HTTP e código estável que o frontend pode usar.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = (message = 'Autenticação necessária.') => new AppError(401, 'UNAUTHORIZED', message);
export const badRequest = (code: string, message: string) => new AppError(400, code, message);
export const forbidden = (message = 'Você não tem permissão para esta ação.') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Recurso não encontrado.') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
