import { Router } from 'express';
import { z } from 'zod';
import { idParamSchema } from '../../http/schemas';
import type { EventsService } from './events.service';

// Texto opcional: "" ou ausente viram null.
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

const eventSchema = z.object({
  name: z.string().trim().min(3, 'Informe o nome do evento.').max(120),
  subtitle: optionalText(120),
  venue: z.string().trim().min(2, 'Informe o local.').max(120),
  // Aceita qualquer data ISO com fuso e normaliza para UTC (o mesmo formato do resto do banco).
  startsAt: z.iso.datetime({ offset: true, message: 'Data inválida.' }).transform((value) => new Date(value).toISOString()),
  priceCents: z.number().int('Preço em centavos inteiros.').min(0).max(10_000_000),
  capacity: z.number().int().min(1, 'Capacidade mínima de 1.').max(100_000),
  // Caminho do próprio site (/images/...) ou URL http(s). Bloqueia "javascript:" e similares.
  imageUrl: optionalText(500).refine((value) => value === null || value.startsWith('/') || /^https?:\/\//.test(value), {
    message: 'Use um caminho começando com / ou uma URL http(s).',
  }),
});

// Montado em /api/admin/events, atrás do requireAdmin (401 sem sessão, 403 sem papel admin).
export function adminEventsRoutes(eventsService: EventsService) {
  const router = Router();

  router.post('/', (req, res) => {
    res.status(201).json({ data: eventsService.create(eventSchema.parse(req.body)) });
  });

  router.put('/:id', (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json({ data: eventsService.update(id, eventSchema.parse(req.body)) });
  });

  return router;
}
