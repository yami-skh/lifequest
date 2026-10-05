-- Друзья, ступень 1 (docs/arch/11-friends.md). Применить: npx wrangler d1 migrations apply lifequest --remote
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  secret_hash TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
-- Пара хранится дважды: a→b и b→a.
CREATE TABLE friends (
  a TEXT NOT NULL,
  b TEXT NOT NULL,
  since INTEGER NOT NULL,
  PRIMARY KEY (a, b)
);
CREATE TABLE cards (
  player TEXT NOT NULL,
  week TEXT NOT NULL,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (player, week)
);
CREATE TABLE reactions (
  from_p TEXT NOT NULL,
  to_p TEXT NOT NULL,
  week TEXT NOT NULL,
  emoji TEXT NOT NULL,
  at INTEGER NOT NULL,
  PRIMARY KEY (from_p, to_p, week)
);
-- Попытки добавить по коду за час (против перебора).
CREATE TABLE attempts (
  player TEXT NOT NULL,
  hour TEXT NOT NULL,
  n INTEGER NOT NULL,
  PRIMARY KEY (player, hour)
);
