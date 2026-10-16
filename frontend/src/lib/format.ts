// A API trabalha em centavos e UTC; a formatação para o usuário acontece só aqui.

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' });
const shortDateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' });
const longDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export const formatMoney = (cents: number) => money.format(cents / 100);
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
export const formatShortDateTime = (iso: string) => shortDateTime.format(new Date(iso));
export const formatDayMonth = (iso: string) => dayMonth.format(new Date(iso)); // "08 de março"
export const formatLongDate = (iso: string) => longDate.format(new Date(iso)); // "31 de outubro de 2026"
export const formatTime = (iso: string) => time.format(new Date(iso)); // "20:00"

// "Ana Souza" → "AS"
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');


export function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
