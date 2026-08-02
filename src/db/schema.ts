/**
 * Verso — esquema SQLite.
 *
 * Tres ejes que se cruzan pero no se mezclan (ARQUITECTURA.md §3.1):
 *   lectura       series → book → part → unit
 *   mundo         entity / appearance / relation
 *   presentación  card / asset
 *
 * El estado del usuario (progress, user_note, user_media) vive aparte y NINGÚN
 * pack lo toca. Actualizar contenido no puede borrar por dónde vas ni lo que escribiste.
 */

export const SCHEMA_VERSION = 1;

export const DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── packs ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pack (
  id           TEXT PRIMARY KEY,
  version      TEXT NOT NULL,
  schema       INTEGER NOT NULL,
  title        TEXT NOT NULL,
  language     TEXT,
  theme        TEXT,
  source_uri   TEXT,
  installed_at INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- ── eje de lectura ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS series (
  id      TEXT PRIMARY KEY,
  pack_id TEXT NOT NULL REFERENCES pack(id) ON DELETE CASCADE,
  title   TEXT NOT NULL,
  author  TEXT,
  sort    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS book (
  id          TEXT PRIMARY KEY,
  series_id   TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  pack_id     TEXT NOT NULL REFERENCES pack(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  number      INTEGER NOT NULL DEFAULT 1,
  cover_asset TEXT,
  sort        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS part (
  id      TEXT PRIMARY KEY,
  book_id TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  title   TEXT,
  number  INTEGER,
  sort    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS unit (
  id           TEXT PRIMARY KEY,
  book_id      TEXT NOT NULL REFERENCES book(id) ON DELETE CASCADE,
  part_id      TEXT REFERENCES part(id) ON DELETE SET NULL,
  kind         TEXT NOT NULL,
  number       INTEGER,
  label        TEXT NOT NULL,
  title        TEXT,
  epigraph     TEXT,
  epigraph_src TEXT,
  pov          TEXT,
  sort         INTEGER NOT NULL,
  timeline_at  INTEGER,
  reveal_key   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS unit_book_sort ON unit(book_id, sort);

-- ── eje del mundo ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity (
  id          TEXT PRIMARY KEY,
  pack_id     TEXT NOT NULL REFERENCES pack(id) ON DELETE CASCADE,
  book_id     TEXT REFERENCES book(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  name        TEXT NOT NULL,
  aka         TEXT,
  summary     TEXT,
  body        TEXT,
  canon_asset TEXT,
  accent      TEXT,
  reveal_key  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS entity_pack_kind ON entity(pack_id, kind);

CREATE TABLE IF NOT EXISTS appearance (
  id         TEXT PRIMARY KEY,
  entity_id  TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  unit_id    TEXT NOT NULL REFERENCES unit(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  note       TEXT,
  reveal_key INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS appearance_unit ON appearance(unit_id);
CREATE INDEX IF NOT EXISTS appearance_entity ON appearance(entity_id);

CREATE TABLE IF NOT EXISTS relation (
  id         TEXT PRIMARY KEY,
  from_id    TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  to_id      TEXT NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  label      TEXT,
  reveal_key INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS relation_from ON relation(from_id);

-- ── presentación ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset (
  id          TEXT PRIMARY KEY,
  pack_id     TEXT REFERENCES pack(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  uri         TEXT NOT NULL,
  width       INTEGER NOT NULL DEFAULT 0,
  height      INTEGER NOT NULL DEFAULT 0,
  blurhash    TEXT,
  duration_ms INTEGER,
  caption     TEXT,
  credit      TEXT,
  prompt      TEXT,
  tool        TEXT,
  seed        TEXT,
  reveal_key  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS card (
  id         TEXT PRIMARY KEY,
  pack_id    TEXT REFERENCES pack(id) ON DELETE CASCADE,
  unit_id    TEXT REFERENCES unit(id) ON DELETE CASCADE,
  entity_id  TEXT REFERENCES entity(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  slot       TEXT NOT NULL DEFAULT 'body',
  title      TEXT,
  body       TEXT,
  asset_id   TEXT REFERENCES asset(id) ON DELETE SET NULL,
  ref_entity TEXT REFERENCES entity(id) ON DELETE SET NULL,
  sort       INTEGER NOT NULL DEFAULT 0,
  reveal_key INTEGER NOT NULL,
  CHECK (unit_id IS NOT NULL OR entity_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS card_unit ON card(unit_id, sort);
CREATE INDEX IF NOT EXISTS card_entity ON card(entity_id, sort);

-- ── estado del usuario · NUNCA viene del pack ────────────────────────────
CREATE TABLE IF NOT EXISTS progress (
  book_id    TEXT PRIMARY KEY,
  unit_id    TEXT NOT NULL,
  reveal_key INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_note (
  id         TEXT PRIMARY KEY,
  unit_id    TEXT,
  entity_id  TEXT,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_media (
  id         TEXT PRIMARY KEY,
  unit_id    TEXT,
  entity_id  TEXT,
  asset_id   TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS setting (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ── asistente ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_thread (
  id         TEXT PRIMARY KEY,
  book_id    TEXT,
  unit_id    TEXT,
  title      TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_message (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES chat_thread(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  body       TEXT NOT NULL,
  reveal_key INTEGER NOT NULL DEFAULT 0,
  unit_label TEXT,
  model      TEXT,
  pending    INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS chat_message_thread ON chat_message(thread_id, created_at);
`;

/**
 * Índice de búsqueda. Deliberadamente NO guarda reveal_key: se une con la tabla
 * origen y se filtra ahí (ARQUITECTURA.md §3.4). Un índice que filtra por sí mismo
 * se desincroniza al actualizar un pack.
 */
export const DDL_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS search USING fts5(
  ref UNINDEXED,
  ref_kind UNINDEXED,
  title,
  body,
  tokenize = "unicode61 remove_diacritics 2"
);
`;
