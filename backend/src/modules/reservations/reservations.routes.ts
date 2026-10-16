import { Router } from 'express';
import { z } from 'zod';
import { currentUser } from '../../http/require-auth';
import type { Clock } from '../../lib/clock';
import { idParamSchema } from '../../http/schemas';
import type { ReservationsService } from './reservations.service';

// z.number().int() recusa "2" (texto), 0, 1.5 e 5. Campos extras (price, userId...) são descartados pelo Zod.
const createSchema = z.object({
  eventId: z.number().int().positive(),
  quantity: z.number().int().min(1, 'Mínimo de 1 ingresso.').max(4, 'Máximo de 4 ingressos por reserva.'),
});

// Toda resposta de reserva leva o horário do servidor: o countdown do frontend usa
// a diferença entre serverTime e expiresAt, e não o relógio do navegador.
export function reservationsRoutes(service: ReservationsService, clock: Clock) {
  const router = Router();
  const withServerTime = <T>(data: T) => ({ data, serverTime: clock.now().toISOString() });

  router.post('/', (req, res) => {
    const { eventId, quantity } = createSchema.parse(req.body);
    res.status(201).json(withServerTime(service.create(currentUser(res).id, eventId, quantity)));
  });

  router.get('/', (_req, res) => {
    res.json(withServerTime(service.list(currentUser(res).id)));
  });

  router.get('/:id', (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(withServerTime(service.get(id, currentUser(res).id)));
  });

  router.post('/:id/confirm', (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(withServerTime(service.confirm(id, currentUser(res).id)));
  });

  router.post('/:id/cancel', (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    res.json(withServerTime(service.cancel(id, currentUser(res).id)));
  });

  return router;
}
