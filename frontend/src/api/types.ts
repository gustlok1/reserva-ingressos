// Tipos das respostas da API (espelham os DTOs do backend).

export interface User {
  id: number;
  email: string;
  name: string;
}

export interface EventItem {
  id: number;
  name: string;
  venue: string;
  startsAt: string;
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
  event: { id: number; name: string; venue: string; startsAt: string };
}

export interface WithServerTime<T> {
  data: T;
  serverTime: string;
}
