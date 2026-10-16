-- Datas são TEXT em ISO-8601 UTC (ex.: 2026-10-16T12:00:00.000Z), sempre geradas por Date#toISOString().
-- Como o formato é fixo, comparar as strings equivale a comparar as datas.
-- Valores monetários são INTEGER em centavos.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);

-- Guardamos o hash SHA-256 do token, nunca o token em si: se o banco vazar, as sessões não podem ser usadas.
CREATE TABLE sessions (
  token_hash TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL,
  expires_at TEXT    NOT NULL
);

CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT    NOT NULL UNIQUE, -- chave natural usada pelo seed para não duplicar registros
  name        TEXT    NOT NULL,
  venue       TEXT    NOT NULL,
  starts_at   TEXT    NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  capacity    INTEGER NOT NULL CHECK (capacity > 0),
  created_at  TEXT    NOT NULL
);

-- Listagem ordenada por data e id (requisito da paginação).
CREATE INDEX idx_events_starts_at ON events(starts_at, id);

CREATE TABLE reservations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id),
  event_id         INTEGER NOT NULL REFERENCES events(id),
  quantity         INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 4),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0), -- preço "congelado" no momento da reserva
  total_cents      INTEGER NOT NULL CHECK (total_cents = quantity * unit_price_cents),
  status           TEXT    NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED')),
  created_at       TEXT    NOT NULL,
  expires_at       TEXT    NOT NULL,
  confirmed_at     TEXT,
  cancelled_at     TEXT,
  updated_at       TEXT    NOT NULL
);

-- Cálculo de disponibilidade: soma das reservas CONFIRMED + PENDING ainda válidas de um evento.
CREATE INDEX idx_reservations_event_status ON reservations(event_id, status, expires_at);
-- "Minhas reservas".
CREATE INDEX idx_reservations_user ON reservations(user_id, created_at);
