import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react';
import { errorMessage } from '../api/client';
import { useCreateReservation, useEvent } from '../api/hooks';
import { Alert, Button, ErrorState, LoadingState, PageTitle } from '../components/ui';
import { formatDateTime, formatMoney } from '../lib/format';
import { AvailabilityBadge } from './EventsPage';

const QUANTITIES = [1, 2, 3, 4];

export function EventDetailPage() {
  const id = Number(useParams().id);
  const event = useEvent(id);
  const createReservation = useCreateReservation();
  const navigate = useNavigate();
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

      <PageTitle>{data.name}</PageTitle>

      <section className="panel" aria-labelledby="reservar">
        <ul className="meta">
          <li>
            <CalendarDays size={16} aria-hidden /> {formatDateTime(data.startsAt)}
          </li>
          <li>
            <MapPin size={16} aria-hidden /> {data.venue}
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

        <p className="muted" style={{ marginTop: 'var(--space-4)' }}>
          A reserva fica válida por 5 minutos para você confirmar a compra.
        </p>
      </section>
    </>
  );
}
