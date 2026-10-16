// Relógio de referência do servidor.
// Cada resposta de reserva traz `serverTime`. Guardamos a diferença entre o relógio do servidor
// e o do navegador; o countdown usa Date.now() + offset. Assim, um relógio do computador
// adiantado ou atrasado não muda o prazo exibido. Quem decide a validade é sempre o servidor.

let offsetMs = 0;

export function syncServerClock(serverTime: string) {
  offsetMs = Date.parse(serverTime) - Date.now();
}

export function serverNow() {
  return Date.now() + offsetMs;
}
