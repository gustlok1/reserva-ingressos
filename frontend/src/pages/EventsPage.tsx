import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CalendarDays, MapPin, Search } from 'lucide-react';
import { useEvents } from '../api/hooks';
import type { EventItem } from '../api/types';
import { Button, EmptyState, ErrorState, LoadingState, PageTitle } from '../components/ui';
import { formatDateTime, formatMoney } from '../lib/format';

// Pequeno de propósito: com os 3 eventos do seed, a paginação já aparece na tela.
export const PAGE_SIZE = 2;

export function AvailabilityBadge({ event }: { event: EventItem }) {
  if (event.hasStarted) return <span className="badge badge--soldout">Evento iniciado</span>;
  if (event.available === 0) return <span className="badge badge--soldout">Esgotado</span>;
  return <span className="badge badge--available">{event.available} disponíveis</span>;
}

export function EventsPage() {
  // Busca e página ficam na URL: dá para compartilhar o link e o "voltar" do navegador funciona.
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(search);

  // Espera o usuário parar de digitar (300 ms) antes de buscar, e volta para a página 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput.trim() !== search) setParams(searchInput.trim() ? { search: searchInput.trim() } : {});
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search, setParams]);

  const events = useEvents({ search, page, pageSize: PAGE_SIZE });
  const goToPage = (next: number) => setParams({ ...(search && { search }), page: String(next) });

  return (
    <>
      <PageTitle>Eventos</PageTitle>

      <label className="search">
        <Search size={20} aria-hidden />
        <span className="sr-only">Buscar eventos por nome</span>
        <input className="input" type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Busca por eventos..." />
      </label>

      {events.isPending ? (
        <LoadingState label="Carregando eventos..." />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : events.data.data.length === 0 ? (
        <EmptyState>{search ? `Nenhum evento encontrado para "${search}".` : 'Nenhum evento cadastrado.'}</EmptyState>
      ) : (
        <>
          <ul className="event-grid" aria-busy={events.isFetching}>
            {events.data.data.map((event) => (
              <li key={event.id}>
                <Link to={`/events/${event.id}`} className="card">
                  <h2 className="card__title">{event.name}</h2>
                  <ul className="meta">
                    <li>
                      <CalendarDays size={16} aria-hidden /> {formatDateTime(event.startsAt)}
                    </li>
                    <li>
                      <MapPin size={16} aria-hidden /> {event.venue}
                    </li>
                  </ul>
                  <div className="row row--between">
                    <span className="price">{formatMoney(event.priceCents)}</span>
                    <AvailabilityBadge event={event} />
                  </div>
                </Link>
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
