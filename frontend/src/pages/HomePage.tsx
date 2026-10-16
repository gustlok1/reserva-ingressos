import { Link } from 'react-router';
import { useEvents } from '../api/hooks';
import { EventCard } from '../components/EventCard';
import { EmptyState, ErrorState, LoadingState } from '../components/ui';
import { formatLongDate } from '../lib/format';

// Home pública (como no Figma): destaque do próximo evento disponível + "Próximos eventos".
export function HomePage() {
  const events = useEvents({ search: '', page: 1, pageSize: 6 });

  if (events.isPending) return <LoadingState label="Carregando eventos..." />;
  if (events.isError) return <ErrorState error={events.error} onRetry={() => events.refetch()} />;

  const list = events.data.data;
  if (list.length === 0) return <EmptyState>Nenhum evento cadastrado.</EmptyState>;

  // Destaque: o primeiro evento que ainda dá para comprar (ou o primeiro da lista, se todos esgotaram).
  const featured = list.find((e) => !e.hasStarted && e.available > 0) ?? list[0]!;

  return (
    <>
      <section className="hero" aria-labelledby="destaque">
        <img className="hero__image" src={featured.imageUrl} alt="" />
        <div className="hero__content">
          <h1 id="destaque" className="hero__title">
            {featured.name}
          </h1>
          <p className="hero__subtitle">
            {featured.subtitle ? `${featured.subtitle} · ` : ''}
            {featured.venue}
          </p>
          <div className="row">
            <Link to={`/events/${featured.id}`} className="button button--primary">
              Eu quero!
            </Link>
            <span className="pill">{formatLongDate(featured.startsAt)}</span>
          </div>
        </div>
      </section>

      <h2 className="section-title">
        Próximos <strong>eventos</strong>
      </h2>

      <ul className="event-cards">
        {list.map((event) => (
          <li key={event.id}>
            <EventCard event={event} />
          </li>
        ))}
      </ul>

      {events.data.pagination.totalPages > 1 && (
        <p style={{ textAlign: 'center' }}>
          <Link to="/events" className="button button--secondary">
            Ver todos os eventos
          </Link>
        </p>
      )}
    </>
  );
}
