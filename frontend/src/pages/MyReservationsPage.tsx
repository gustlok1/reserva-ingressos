import { Link } from 'react-router';
import { useReservations } from '../api/hooks';
import { OrderCard } from '../components/OrderCard';
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../components/ui';

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
        <ul className="account__content" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {reservations.data.map((reservation) => (
            <li key={reservation.id}>
              <OrderCard reservation={reservation}>
                <div className="order__actions">
                  <Link
                    to={`/reservations/${reservation.id}`}
                    className={`button ${reservation.status === 'PENDING' ? 'button--primary' : 'button--secondary'}`}
                  >
                    {reservation.status === 'PENDING' ? 'Finalizar compra' : 'Ver pedido'}
                  </Link>
                </div>
              </OrderCard>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
