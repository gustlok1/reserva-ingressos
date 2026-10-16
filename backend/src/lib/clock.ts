// Relógio injetável: o código de negócio nunca chama `new Date()` direto,
// assim os testes conseguem controlar o tempo (ex.: avançar 5 minutos sem esperar).
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
