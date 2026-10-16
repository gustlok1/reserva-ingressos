import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { errorMessage } from '../api/client';
import { useReservation, useReservationAction } from '../api/hooks';
import { Countdown } from '../components/Countdown';
import { OrderCard } from '../components/OrderCard';
import { Alert, Button, ErrorState, LoadingState } from '../components/ui';

const FINAL_MESSAGES = {
  CONFIRMED: { kind: 'success', text: 'Compra confirmada! Seus ingressos estão garantidos.' },
  CANCELLED: { kind: 'success', text: 'Reserva cancelada. Os ingressos foram liberados.' },
  EXPIRED: { kind: 'error', text: 'O prazo para confirmar terminou e a reserva expirou. Os ingressos foram liberados.' },
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

      <OrderCard reservation={data} headingLevel="h1">
        {finalMessage && <Alert kind={finalMessage.kind}>{finalMessage.text}</Alert>}
        {actionError && data.status === 'PENDING' && <Alert kind="error">{errorMessage(actionError)}</Alert>}

        {data.status === 'PENDING' && (
          <>
            <Countdown expiresAt={data.expiresAt} onExpire={handleExpire} />
            <div className="order__actions">
              <Button variant="secondary" onClick={() => cancel.mutate()} loading={cancel.isPending} disabled={busy}>
                Remover esse pedido
              </Button>
              <Button onClick={() => confirm.mutate()} loading={confirm.isPending} disabled={busy}>
                Finalizar compra
              </Button>
            </div>
          </>
        )}
      </OrderCard>
    </>
  );
}
