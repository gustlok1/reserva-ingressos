import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { errorMessage } from '../api/client';
import { useReservation, useReservationAction } from '../api/hooks';
import { Countdown } from '../components/Countdown';
import { Alert, Button, ErrorState, LoadingState, PageTitle, StatusBadge } from '../components/ui';
import { formatDateTime, formatMoney, formatShortDateTime } from '../lib/format';

const FINAL_MESSAGES = {
  CONFIRMED: { kind: 'success', text: 'Compra confirmada! Seus ingressos estão garantidos.' },
  CANCELLED: { kind: 'success', text: 'Reserva cancelada. Os ingressos foram liberados.' },
  EXPIRED: { kind: 'error', text: 'O prazo de 5 minutos terminou e a reserva expirou. Os ingressos foram liberados.' },
} as const;

export function ReservationPage() {
  const id = Number(useParams().id);
  const reservation = useReservation(id);
  const confirm = useReservationAction(id, 'confirm');
  const cancel = useReservationAction(id, 'cancel');

  // Quando o countdown zera, não decidimos nada no navegador: pedimos à API o estado real.
  const { refetch } = reservation;
  const handleExpire = useCallback(() => void refetch(), [refetch]);

  if (reservation.isPending) return <LoadingState label="Carregando reserva..." />;
  if (reservation.isError) return <ErrorState error={reservation.error} onRetry={() => reservation.refetch()} />;

  const { data } = reservation;
  const busy = confirm.isPending || cancel.isPending;
  const actionError = confirm.error ?? cancel.error;
  const finalMessage = data.status === 'PENDING' ? null : FINAL_MESSAGES[data.status];

  return (
    <>
      <Link to="/reservations" className="row">
        <ArrowLeft size={16} aria-hidden /> Minhas reservas
      </Link>

      <PageTitle>Reserva #{data.id}</PageTitle>

      <section className="panel" aria-labelledby="resumo">
        <div className="row row--between">
          <h2 id="resumo" className="card__title">
            {data.event.name}
          </h2>
          <StatusBadge status={data.status} />
        </div>

        <dl className="summary" style={{ margin: 'var(--space-4) 0' }}>
          <dt>Data do evento</dt>
          <dd>{formatDateTime(data.event.startsAt)}</dd>
          <dt>Local</dt>
          <dd>{data.event.venue}</dd>
          <dt>Quantidade</dt>
          <dd>{data.quantity}</dd>
          <dt>Preço unitário</dt>
          <dd>{formatMoney(data.unitPriceCents)}</dd>
          <dt>Total</dt>
          <dd>
            <strong>{formatMoney(data.totalCents)}</strong>
          </dd>
          <dt>Reservada em</dt>
          <dd>{formatShortDateTime(data.createdAt)}</dd>
        </dl>

        {finalMessage && <Alert kind={finalMessage.kind}>{finalMessage.text}</Alert>}
        {actionError && data.status === 'PENDING' && <Alert kind="error">{errorMessage(actionError)}</Alert>}

        {data.status === 'PENDING' && (
          <div className="row row--between" style={{ marginTop: 'var(--space-4)', alignItems: 'end' }}>
            <Countdown expiresAt={data.expiresAt} onExpire={handleExpire} />
            <div className="row">
              <Button variant="secondary" onClick={() => cancel.mutate()} loading={cancel.isPending} disabled={busy}>
                Cancelar reserva
              </Button>
              <Button onClick={() => confirm.mutate()} loading={confirm.isPending} disabled={busy}>
                Confirmar compra
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
