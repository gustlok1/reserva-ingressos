import { Link } from 'react-router';
import { useReservations } from '../api/hooks';
import { EmptyState, ErrorState, LoadingState, PageTitle, StatusBadge } from '../components/ui';
import { formatDateTime, formatMoney } from '../lib/format';

// Lista só as reservas do usuário logado (a API filtra pela sessão), com o estado efetivo de cada uma.
export function MyReservationsPage() {
  const reservations = useReservations();

  return (
    <>
      <PageTitle>Minhas reservas</PageTitle>

      {reservations.isPending ? (
        <LoadingState label="Carregando reservas..." />
      ) : reservations.isError ? (
        <ErrorState error={reservations.error} onRetry={() => reservations.refetch()} />
      ) : reservations.data.length === 0 ? (
        <EmptyState>
          Você ainda não tem reservas. <Link to="/events">Ver eventos</Link>
        </EmptyState>
      ) : (
        <ul className="event-grid">
          {reservations.data.map((reservation) => (
            <li key={reservation.id}>
              <Link to={`/reservations/${reservation.id}`} className="card">
                <div className="row row--between">
                  <h2 className="card__title">{reservation.event.name}</h2>
                  <StatusBadge status={reservation.status} />
                </div>
                <ul className="meta">
                  <li>{formatDateTime(reservation.event.startsAt)}</li>
                  <li>
                    {reservation.quantity} {reservation.quantity === 1 ? 'ingresso' : 'ingressos'}
                  </li>
                </ul>
                <span className="price">{formatMoney(reservation.totalCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
