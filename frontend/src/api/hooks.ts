import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './client';
import { ME_KEY } from './query-client';
import type { EventItem, Paginated, Reservation, User, WithServerTime } from './types';

// ---------- Autenticação ----------

export function useMe() {
  return useQuery({
    queryKey: ME_KEY,
    queryFn: async () => {
      try {
        return (await api<{ user: User }>('/api/auth/me')).user;
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null; // não logado não é erro
        throw error;
      }
    },
    staleTime: Infinity,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      api<{ user: User }>('/api/auth/login', { method: 'POST', body: credentials }),
    onSuccess: ({ user }) => queryClient.setQueryData(ME_KEY, user),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/api/auth/logout', { method: 'POST' }),
    onSettled: () => {
      queryClient.clear(); // remove do cache os dados do usuário anterior
      queryClient.setQueryData(ME_KEY, null);
    },
  });
}

// ---------- Eventos ----------

export function useEvents(params: { search: string; page: number; pageSize: number }) {
  const query = new URLSearchParams({ page: String(params.page), pageSize: String(params.pageSize) });
  if (params.search) query.set('search', params.search);

  return useQuery({
    queryKey: ['events', params],
    queryFn: () => api<Paginated<EventItem>>(`/api/events?${query}`),
    placeholderData: keepPreviousData, // mantém a página anterior na tela enquanto a próxima carrega
  });
}

export function useEvent(id: number) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: async () => (await api<{ data: EventItem }>(`/api/events/${id}`)).data,
  });
}

// ---------- Reservas ----------

export function useReservations() {
  return useQuery({
    queryKey: ['reservations'],
    queryFn: async () => (await api<WithServerTime<Reservation[]>>('/api/reservations')).data,
  });
}

export function useReservation(id: number) {
  return useQuery({
    queryKey: ['reservation', id],
    queryFn: async () => (await api<WithServerTime<Reservation>>(`/api/reservations/${id}`)).data,
  });
}

// Depois de qualquer mudança em reservas, disponibilidade e listas ficam desatualizadas: invalidamos tudo.
function useInvalidateAfterChange() {
  const queryClient = useQueryClient();
  return (reservation?: Reservation) => {
    if (reservation) queryClient.setQueryData(['reservation', reservation.id], reservation);
    void queryClient.invalidateQueries({ queryKey: ['reservations'] });
    void queryClient.invalidateQueries({ queryKey: ['events'] });
    void queryClient.invalidateQueries({ queryKey: ['event'] });
  };
}

export function useCreateReservation() {
  const invalidate = useInvalidateAfterChange();
  return useMutation({
    mutationFn: (input: { eventId: number; quantity: number }) =>
      api<WithServerTime<Reservation>>('/api/reservations', { method: 'POST', body: input }),
    onSuccess: ({ data }) => invalidate(data),
    onError: () => invalidate(), // ex.: 409 por falta de ingressos → busca a disponibilidade atual
  });
}

export function useReservationAction(id: number, action: 'confirm' | 'cancel') {
  const queryClient = useQueryClient();
  const invalidate = useInvalidateAfterChange();
  return useMutation({
    mutationFn: () => api<WithServerTime<Reservation>>(`/api/reservations/${id}/${action}`, { method: 'POST' }),
    onSuccess: ({ data }) => invalidate(data),
    onError: () => {
      // ex.: 409 porque expirou → recarrega a reserva para mostrar o estado real
      void queryClient.invalidateQueries({ queryKey: ['reservation', id] });
      invalidate();
    },
  });
}
