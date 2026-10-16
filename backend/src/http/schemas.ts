import { z } from 'zod';

// Parâmetro :id das rotas. Path chega como texto; o coerce converte e a validação exige inteiro positivo.
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
