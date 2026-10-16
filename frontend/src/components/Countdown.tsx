import { useEffect, useRef, useState } from 'react';
import { serverNow } from '../api/server-clock';
import { formatCountdown } from '../lib/format';

/**
 * Contagem regressiva até `expiresAt`, usando o horário do servidor (serverNow) como referência.
 * Recarregar a página não reinicia o prazo, porque `expiresAt` vem da API.
 * Quando chega a zero, chama `onExpire` uma vez; a tela então consulta a API para saber o estado real.
 */
export function Countdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const deadline = Date.parse(expiresAt);
  const [remaining, setRemaining] = useState(() => deadline - serverNow());
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const tick = () => {
      const ms = deadline - serverNow();
      setRemaining(ms);
      if (ms <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        onExpire();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [deadline, onExpire]);

  return (
    <div>
      <p className="muted">Tempo restante para confirmar</p>
      {/* aria-live desligado: anunciar a cada segundo seria ruído; o aviso de expiração vem da tela. */}
      <p className="countdown" aria-live="off">
        <span className="sr-only">Tempo restante: </span>
        {formatCountdown(remaining)}
      </p>
    </div>
  );
}
