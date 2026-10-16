import { Link } from 'react-router';
import { useEvents } from '../api/hooks';
import { EmptyState, ErrorState, LoadingState, PageTitle } from '../components/ui';
import { formatMoney, formatShortDateTime } from '../lib/format';

// Lista de eventos do admin, com a ocupação de cada um (vendidos + reservados).
export function AdminEventsPage() {
  const events = useEvents({ search: '', page: 1, pageSize: 50 });

  return (
    <>
      <div className="row row--between">
        <PageTitle>Eventos</PageTitle>
        <Link to="/admin/events/new" className="button button--primary">
          Novo evento
        </Link>
      </div>

      {events.isPending ? (
        <LoadingState label="Carregando eventos..." />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : events.data.data.length === 0 ? (
        <EmptyState>Nenhum evento cadastrado.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Evento</th>
                <th scope="col">Data</th>
                <th scope="col">Preço</th>
                <th scope="col">Ocupação</th>
                <th scope="col">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {events.data.data.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{event.name}</strong>
                    <br />
                    <span className="muted">{event.venue}</span>
                  </td>
                  <td>{formatShortDateTime(event.startsAt)}</td>
                  <td>{formatMoney(event.priceCents)}</td>
                  <td>
                    {event.capacity - event.available} de {event.capacity}
                  </td>
                  <td>
                    <Link to={`/admin/events/${event.id}`}>Editar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
