import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { createQueryClient } from '../api/query-client';
import type { EventItem, Reservation } from '../api/types';
import { App } from '../App';

// Renderiza o app inteiro numa rota, com um QueryClient novo (sem cache entre testes).
export function renderApp(route: string) {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const loggedIn = http.get('*/api/auth/me', () =>
  HttpResponse.json({ user: { id: 1, email: 'ana@exemplo.com', name: 'Ana Souza' } }),
);

export const makeEvent = (overrides: Partial<EventItem> = {}): EventItem => ({
  id: 3,
  name: 'Camarote VIP - Noite Eletrônica',
  venue: 'Espaço Dry',
  startsAt: '2026-11-15T23:00:00.000Z',
  priceCents: 45000,
  capacity: 2,
  available: 2,
  hasStarted: false,
  ...overrides,
});

export const makeReservation = (overrides: Partial<Reservation> = {}): Reservation => ({
  id: 10,
  status: 'PENDING',
  quantity: 2,
  unitPriceCents: 45000,
  totalCents: 90000,
  createdAt: '2026-10-16T12:00:00.000Z',
  expiresAt: '2026-10-16T12:05:00.000Z',
  confirmedAt: null,
  cancelledAt: null,
  event: { id: 3, name: 'Camarote VIP - Noite Eletrônica', venue: 'Espaço Dry', startsAt: '2026-11-15T23:00:00.000Z' },
  ...overrides,
});
