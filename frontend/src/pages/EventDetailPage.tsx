import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, Clock, MapPin } from 'lucide-react';
import { errorMessage } from '../api/client';
import { useCreateReservation, useEvent, useMe } from '../api/hooks';
import { Alert, Button, ErrorState, LoadingState, PageTitle } from '../components/ui';
import { formatLongDate, formatMoney, formatTime } from '../lib/format';
import { AvailabilityBadge } from './EventsPage';

const QUANTITIES = [1, 2, 3, 4];

export function EventDetailPage() {
  const id = Number(useParams().id);
  const event = useEvent(id);
  const { data: user } = useMe();
  const createReservation = useCreateReservation();
  const navigate = useNavigate();
  const location = useLocation();
  const [quantity, setQuantity] = useState(1);

  if (event.isPending) return <LoadingState label="Carregando evento..." />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => event.refetch()} />;

  const { data } = event;
  const canReserve = !data.hasStarted && data.available > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Só eventId e quantidade vão para a API: preço, total e validade são calculados no servidor.
    createReservation.mutate(
      { eventId: data.id, quantity },
      { onSuccess: ({ data: reservation }) => navigate(`/reservations/${reservation.id}`) },
    );
  };

  return (
    <>
      <Link to="/events" className="row">
        <ArrowLeft size={16} aria-hidden /> Voltar para eventos
      </Link>

      <div className="event-detail">
        <img className="event-detail__image" src={data.imageUrl} alt="" />

        <section className="panel" aria-labelledby="reservar">
          <PageTitle>{data.name}</PageTitle>
          {data.subtitle && <p className="event-detail__subtitle">{data.subtitle}</p>}

          <ul className="order__rows">
            <li>
              <CalendarDays size={18} aria-hidden /> {formatLongDate(data.startsAt)}
            </li>
            <li>
              <Clock size={18} aria-hidden /> {formatTime(data.startsAt)}
            </li>
            <li>
              <MapPin size={18} aria-hidden /> {data.venue}
            </li>
          </ul>

          <div className="row row--between" style={{ margin: 'var(--space-6) 0' }}>
            <span className="price">{formatMoney(data.priceCents)}</span>
            <AvailabilityBadge event={data} />
          </div>

          <h2 id="reservar" className="card__title">
            Reservar ingressos
          </h2>

          {createReservation.isError && <Alert kind="error">{errorMessage(createReservation.error)}</Alert>}

          {user ? (
            <form className="row" onSubmit={handleSubmit} style={{ marginTop: 'var(--space-4)', alignItems: 'end' }}>
              <label className="field">
                <span className="field__label">Quantidade</span>
                <select className="input" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} disabled={!canReserve}>
                  {QUANTITIES.map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'ingresso' : 'ingressos'}
                    </option>
                  ))}
                </select>
              </label>

              <Button type="submit" loading={createReservation.isPending} disabled={!canReserve}>
                Reservar · {formatMoney(data.priceCents * quantity)}
              </Button>
            </form>
          ) : (
            // Catálogo é público, mas reservar exige login: volta para cá depois de entrar.
            <p style={{ marginTop: 'var(--space-4)' }}>
              <Link to="/login" state={{ from: location.pathname }} className="button button--primary">
                Entrar para reservar
              </Link>
            </p>
          )}

          <p className="muted" style={{ marginTop: 'var(--space-4)' }}>
            A reserva fica válida por alguns minutos para você confirmar a compra.
          </p>
        </section>
      </div>
    </>
  );
}
