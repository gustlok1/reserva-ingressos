import { Link } from 'react-router';
import type { EventItem } from '../api/types';
import { formatDayMonth, formatMoney } from '../lib/format';

const TAPE_TEXT = Array(8).fill('ESGOTADO').join('   ');

// Card de evento do Figma: data, imagem, local, nome, subtítulo laranja e "EU QUERO!".
// Esgotado ou já iniciado: card apagado e fitas cruzadas sobre a imagem.
export function EventCard({ event }: { event: EventItem }) {
  const unavailable = event.hasStarted || event.available === 0;
  const status = event.hasStarted ? 'Evento iniciado' : event.available === 0 ? 'Esgotado' : `${event.available} disponíveis`;

  return (
    <article className={`event-card${unavailable ? ' event-card--soldout' : ''}`} aria-label={`${event.name}, ${status}`}>
      <p className="event-card__date">{formatDayMonth(event.startsAt)}</p>

      <div className="event-card__media">
        <img src={event.imageUrl} alt="" loading="lazy" />
        {unavailable && (
          // Decorativo: o status já está no aria-label do card.
          <>
            <div className="tape tape--a" aria-hidden>
              {event.hasStarted ? TAPE_TEXT.replaceAll('ESGOTADO', 'INICIADO') : TAPE_TEXT}
            </div>
            <div className="tape tape--b" aria-hidden>
              {event.hasStarted ? TAPE_TEXT.replaceAll('ESGOTADO', 'INICIADO') : TAPE_TEXT}
            </div>
          </>
        )}
      </div>

      <div className="event-card__info">
        <p className="event-card__venue">{event.venue}</p>
        <h3 className="event-card__name">{event.name}</h3>
        {event.subtitle && <p className="event-card__subtitle">{event.subtitle}</p>}
        <p className="event-card__price">
          {formatMoney(event.priceCents)} · {status}
        </p>
      </div>

      <Link to={`/events/${event.id}`} className="button button--primary">
        Eu quero!
      </Link>
    </article>
  );
}
