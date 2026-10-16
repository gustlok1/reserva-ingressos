// Tipos das respostas da API (espelham os DTOs do backend).

export interface User {
  id: number;
  email: string;
  name: string;
  role: 'user' | 'admin';
}

export interface EventItem {
  id: number;
  name: string;
  subtitle: string | null;
  venue: string;
  startsAt: string;
  imageUrl: string;
  priceCents: number;
  capacity: number;
  available: number;
  hasStarted: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export interface Reservation {
  id: number;
  status: ReservationStatus;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  event: { id: number; name: string; subtitle: string | null; venue: string; startsAt: string; imageUrl: string };
}

// Dados do formulário de evento no admin (preço em centavos, data em ISO UTC).
export interface EventInput {
  name: string;
  subtitle: string | null;
  venue: string;
  startsAt: string;
  priceCents: number;
  capacity: number;
  imageUrl: string | null;
}

export interface WithServerTime<T> {
  data: T;
  serverTime: string;
}
