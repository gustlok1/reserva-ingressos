import type { ReactNode } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, MapPin, Ticket, XCircle } from 'lucide-react';
import type { Reservation, ReservationStatus } from '../api/types';
import { formatLongDate, formatMoney, formatTime } from '../lib/format';

const PILL: Record<ReservationStatus, { label: string; icon: ReactNode }> = {
  PENDING: { label: 'Aguardando confirmação', icon: <AlertTriangle size={14} aria-hidden /> },
  CONFIRMED: { label: 'Confirmada', icon: <CheckCircle2 size={14} aria-hidden /> },
  CANCELLED: { label: 'Cancelada', icon: <XCircle size={14} aria-hidden /> },
  EXPIRED: { label: 'Expirada', icon: <XCircle size={14} aria-hidden /> },
};

export function StatusPill({ status }: { status: ReservationStatus }) {
  return (
    <span className={`status-pill status-pill--${status}`}>
      {PILL[status].icon}
      {PILL[status].label}
    </span>
  );
}

// Card de pedido do Figma: imagem à esquerda; número, nome, status e detalhes à direita.
// `children` são as ações (botões) e o que mais a tela quiser mostrar embaixo.
export function OrderCard({ reservation, headingLevel = 'h2', children }: { reservation: Reservation; headingLevel?: 'h1' | 'h2'; children?: ReactNode }) {
  const Heading = headingLevel;
  const { event } = reservation;

  return (
    <article className="order">
      <img className="order__image" src={event.imageUrl} alt="" />
      <div className="order__body">
        <p className="order__number">Pedido #{String(reservation.id).padStart(4, '0')}</p>
        <Heading className="order__name">{event.name}</Heading>
        <StatusPill status={reservation.status} />

        <ul className="order__rows">
          <li>
            <CalendarDays size={18} aria-hidden /> {formatLongDate(event.startsAt)}
          </li>
          <li>
            <Clock size={18} aria-hidden /> {formatTime(event.startsAt)}
          </li>
          <li>
            <MapPin size={18} aria-hidden /> {event.venue}
          </li>
          {event.subtitle && (
            <li>
              <Ticket size={18} aria-hidden /> {event.subtitle}
            </li>
          )}
          <li>
            <strong>Quantidade:</strong> {reservation.quantity}x {reservation.quantity === 1 ? 'ingresso' : 'ingressos'}
          </li>
          <li>
            <strong>Preço unitário:</strong> {formatMoney(reservation.unitPriceCents)}
          </li>
        </ul>

        <p className="order__total">Total: {formatMoney(reservation.totalCents)}</p>
        {children}
      </div>
    </article>
  );
}
