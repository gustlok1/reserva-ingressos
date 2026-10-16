import { Link, useSearchParams } from 'react-router';
import { useEvents } from '../api/hooks';
import type { EventItem } from '../api/types';
import { EventCard } from '../components/EventCard';
import { Button, EmptyState, ErrorState, LoadingState, PageTitle } from '../components/ui';

// Pequeno de propósito: com os 3 eventos do seed, a paginação já aparece na tela.
export const PAGE_SIZE = 2;

export function AvailabilityBadge({ event }: { event: EventItem }) {
  if (event.hasStarted) return <span className="badge badge--soldout">Evento iniciado</span>;
  if (event.available === 0) return <span className="badge badge--soldout">Esgotado</span>;
  return <span className="badge badge--available">{event.available} disponíveis</span>;
}

// Catálogo completo com paginação no servidor. A busca é feita pelo campo do cabeçalho,
// que coloca o termo na URL (?search=...); a página atual também fica na URL.
export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const events = useEvents({ search, page, pageSize: PAGE_SIZE });
  const goToPage = (next: number) => setParams({ ...(search && { search }), page: String(next) });

  return (
    <>
      <PageTitle>Eventos</PageTitle>

      {search && (
        <p className="row">
          Resultados para <strong>“{search}”</strong>
          <Link to="/events">Limpar busca</Link>
        </p>
      )}

      {events.isPending ? (
        <LoadingState label="Carregando eventos..." />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : events.data.data.length === 0 ? (
        <EmptyState>{search ? `Nenhum evento encontrado para "${search}".` : 'Nenhum evento cadastrado.'}</EmptyState>
      ) : (
        <>
          <ul className="event-cards" aria-busy={events.isFetching}>
            {events.data.data.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>

          {events.data.pagination.totalPages > 1 && (
            <nav className="pagination" aria-label="Paginação">
              <Button variant="secondary" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
                Anterior
              </Button>
              <span aria-current="page">
                Página {page} de {events.data.pagination.totalPages}
              </span>
              <Button variant="secondary" onClick={() => goToPage(page + 1)} disabled={page >= events.data.pagination.totalPages}>
                Próxima
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
