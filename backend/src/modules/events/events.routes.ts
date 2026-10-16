import { Router } from 'express';
import { z } from 'zod';
import type { EventsService } from './events.service';

// Query string chega sempre como texto: z.coerce converte e depois valida (int, mínimo, máximo).
const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional().transform((value) => value || undefined),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export function eventsRoutes(eventsService: EventsService) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(eventsService.list(listQuerySchema.parse(req.query)));
  });

  router.get('/:id', (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: eventsService.get(id) });
  });

  return router;
}
