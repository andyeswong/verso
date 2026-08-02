/**
 * Verso — capa de repositorio.
 *
 * EL GATE DE SPOILERS VIVE AQUÍ Y SÓLO AQUÍ.
 *
 * Ninguna pantalla ejecuta SQL. Un SELECT crudo desde un componente es un bug de
 * spoiler esperando a pasar, y es el único bug de esta app que no tiene arreglo
 * después de ocurrir (ARQUITECTURA.md §3.3, §9.4).
 *
 * Lo sellado se CUENTA pero no se NOMBRA: ver que hay mundo por delante es parte de
 * leer; ver cuál es el spoiler. El enmascarado se hace aquí, no en el render.
 */
import type * as SQLite from 'expo-sqlite';

export const ALWAYS = 0;
const UNBOUNDED = Number.MAX_SAFE_INTEGER;

export type Reveal = { key: number; unlocked: boolean };

export function reveal(key: number, unlocked = false): Reveal {
  return { key, unlocked };
}

/** El techo efectivo de visibilidad. */
function ceiling(r: Reveal): number {
  return r.unlocked ? UNBOUNDED : r.key;
}

export function revealKeyOf(bookNumber: number, unitSort: number): number {
  return bookNumber * 100000 + unitSort;
}

// ── tipos ───────────────────────────────────────────────────────────────────

export type Unit = {
  id: string;
  book_id: string;
  part_id: string | null;
  kind: string;
  number: number | null;
  label: string;
  title: string | null;
  epigraph: string | null;
  epigraph_src: string | null;
  sort: number;
  reveal_key: number;
};

export type UnitRow = Pick<Unit, 'id' | 'label' | 'kind' | 'sort' | 'reveal_key'> & {
  title: string | null;
  part_title: string | null;
  sealed: boolean;
};

export type Asset = {
  id: string;
  kind: string;
  uri: string;
  width: number;
  height: number;
  blurhash: string | null;
  caption: string | null;
};

export type Card = {
  id: string;
  kind: string;
  slot: string;
  title: string | null;
  body: string | null;
  sort: number;
  asset: Asset | null;
  ref_entity: string | null;
  ref_name: string | null;
  ref_summary: string | null;
  ref_asset_uri: string | null;
  ref_blurhash: string | null;
};

export type Appearing = {
  entity_id: string;
  name: string;
  kind: string;
  summary: string | null;
  role: string;
  note: string | null;
  asset_uri: string | null;
  blurhash: string | null;
};

export type Book = {
  id: string;
  title: string;
  number: number;
  series_title: string;
  author: string | null;
  pack_id: string;
  theme: string | null;
  total_units: number;
};

// ── libros y progreso ───────────────────────────────────────────────────────

export async function listBooks(db: SQLite.SQLiteDatabase): Promise<Book[]> {
  return db.getAllAsync<Book>(`
    SELECT b.id, b.title, b.number, b.pack_id,
           s.title AS series_title, s.author,
           p.theme,
           (SELECT COUNT(*) FROM unit u WHERE u.book_id = b.id) AS total_units
    FROM book b
    JOIN series s ON s.id = b.series_id
    JOIN pack   p ON p.id = b.pack_id
    ORDER BY s.sort, b.sort, b.number
  `);
}

export async function getProgress(
  db: SQLite.SQLiteDatabase,
  bookId: string
): Promise<{ unit_id: string; reveal_key: number } | null> {
  return db.getFirstAsync<{ unit_id: string; reveal_key: number }>(
    'SELECT unit_id, reveal_key FROM progress WHERE book_id = ?',
    bookId
  );
}

export async function setProgress(
  db: SQLite.SQLiteDatabase,
  bookId: string,
  unitId: string
): Promise<void> {
  const u = await db.getFirstAsync<{ reveal_key: number }>(
    'SELECT reveal_key FROM unit WHERE id = ?',
    unitId
  );
  if (!u) return;
  await db.runAsync(
    `INSERT INTO progress (book_id, unit_id, reveal_key, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(book_id) DO UPDATE SET unit_id = excluded.unit_id,
                                        reveal_key = excluded.reveal_key,
                                        updated_at = excluded.updated_at`,
    bookId,
    unitId,
    u.reveal_key,
    Date.now()
  );
}

/** El libro y la unidad de "CONTINÚA". Sin progreso, la primera unidad del primer libro. */
export async function getCurrent(db: SQLite.SQLiteDatabase): Promise<{
  book: Book;
  unit: Unit;
  reveal: number;
  position: number;
} | null> {
  const books = await listBooks(db);
  if (books.length === 0) return null;

  const withProgress = await db.getFirstAsync<{ book_id: string; unit_id: string }>(
    'SELECT book_id, unit_id FROM progress ORDER BY updated_at DESC LIMIT 1'
  );

  const book = withProgress
    ? books.find((b) => b.id === withProgress.book_id) ?? books[0]
    : books[0];

  const unit = withProgress
    ? await db.getFirstAsync<Unit>('SELECT * FROM unit WHERE id = ?', withProgress.unit_id)
    : await db.getFirstAsync<Unit>(
        'SELECT * FROM unit WHERE book_id = ? ORDER BY sort LIMIT 1',
        book.id
      );

  if (!unit) return null;

  const pos = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM unit WHERE book_id = ? AND sort <= ?',
    book.id,
    unit.sort
  );

  return { book, unit, reveal: unit.reveal_key, position: pos?.n ?? 1 };
}

// ── unidades ────────────────────────────────────────────────────────────────

/**
 * Todas las unidades del libro. Las que quedan por encima del progreso vuelven
 * SIN título — se ve que existen, no qué son.
 */
export async function listUnits(
  db: SQLite.SQLiteDatabase,
  bookId: string,
  r: Reveal
): Promise<UnitRow[]> {
  const cap = ceiling(r);
  const rows = await db.getAllAsync<
    UnitRow & { title: string | null; part_title: string | null }
  >(
    `SELECT u.id, u.label, u.kind, u.sort, u.reveal_key, u.title, p.title AS part_title
     FROM unit u
     LEFT JOIN part p ON p.id = u.part_id
     WHERE u.book_id = ?
     ORDER BY u.sort`,
    bookId
  );

  return rows.map((row) => {
    const sealed = row.reveal_key > cap;
    return { ...row, sealed, title: sealed ? null : row.title };
  });
}

export async function getUnit(
  db: SQLite.SQLiteDatabase,
  unitId: string,
  r: Reveal
): Promise<{ unit: Unit; sealed: boolean } | null> {
  const unit = await db.getFirstAsync<Unit>('SELECT * FROM unit WHERE id = ?', unitId);
  if (!unit) return null;
  const sealed = unit.reveal_key > ceiling(r);
  if (sealed) {
    return {
      sealed,
      unit: { ...unit, title: null, epigraph: null, epigraph_src: null },
    };
  }
  return { unit, sealed };
}

export async function neighbours(
  db: SQLite.SQLiteDatabase,
  unit: Unit
): Promise<{ prev: Unit | null; next: Unit | null }> {
  const prev = await db.getFirstAsync<Unit>(
    'SELECT * FROM unit WHERE book_id = ? AND sort < ? ORDER BY sort DESC LIMIT 1',
    unit.book_id,
    unit.sort
  );
  const next = await db.getFirstAsync<Unit>(
    'SELECT * FROM unit WHERE book_id = ? AND sort > ? ORDER BY sort ASC LIMIT 1',
    unit.book_id,
    unit.sort
  );
  return { prev: prev ?? null, next: next ?? null };
}

// ── cards ───────────────────────────────────────────────────────────────────

export async function listCards(
  db: SQLite.SQLiteDatabase,
  unitId: string,
  r: Reveal
): Promise<Card[]> {
  return db.getAllAsync<Card>(
    `SELECT c.id, c.kind, c.slot, c.title, c.body, c.sort,
            c.ref_entity,
            e.name    AS ref_name,
            e.summary AS ref_summary,
            ea.uri    AS ref_asset_uri,
            ea.blurhash AS ref_blurhash,
            a.id AS a_id, a.kind AS a_kind, a.uri AS a_uri,
            a.width AS a_width, a.height AS a_height,
            a.blurhash AS a_blurhash, a.caption AS a_caption
     FROM card c
     LEFT JOIN asset  a  ON a.id = c.asset_id
     LEFT JOIN entity e  ON e.id = c.ref_entity
     LEFT JOIN asset  ea ON ea.id = e.canon_asset
     WHERE c.unit_id = ? AND c.reveal_key <= ?
     ORDER BY c.sort`,
    unitId,
    ceiling(r)
  ).then((rows: any[]) =>
    rows.map((x) => ({
      id: x.id,
      kind: x.kind,
      slot: x.slot,
      title: x.title,
      body: x.body,
      sort: x.sort,
      ref_entity: x.ref_entity,
      ref_name: x.ref_name,
      ref_summary: x.ref_summary,
      ref_asset_uri: x.ref_asset_uri,
      ref_blurhash: x.ref_blurhash,
      asset: x.a_id
        ? {
            id: x.a_id,
            kind: x.a_kind,
            uri: x.a_uri,
            width: x.a_width,
            height: x.a_height,
            blurhash: x.a_blurhash,
            caption: x.a_caption,
          }
        : null,
    }))
  );
}

// ── entidades ───────────────────────────────────────────────────────────────

/** Quién aparece en esta unidad, más cuántas hay aún sin revelar (sin nombrarlas). */
export async function listAppearing(
  db: SQLite.SQLiteDatabase,
  unitId: string,
  r: Reveal
): Promise<{ visible: Appearing[]; hidden: number }> {
  const cap = ceiling(r);

  const visible = await db.getAllAsync<Appearing>(
    `SELECT ap.entity_id, e.name, e.kind, e.summary, ap.role, ap.note,
            a.uri AS asset_uri, a.blurhash
     FROM appearance ap
     JOIN entity e ON e.id = ap.entity_id
     LEFT JOIN asset a ON a.id = e.canon_asset
     WHERE ap.unit_id = ? AND ap.reveal_key <= ? AND e.reveal_key <= ?
     ORDER BY (ap.role = 'introduced') DESC, e.name`,
    unitId,
    cap,
    cap
  );

  const hidden = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM appearance ap
     JOIN entity e ON e.id = ap.entity_id
     WHERE ap.unit_id = ? AND (ap.reveal_key > ? OR e.reveal_key > ?)`,
    unitId,
    cap,
    cap
  );

  return { visible, hidden: hidden?.n ?? 0 };
}

export type EntityFull = {
  id: string;
  kind: string;
  name: string;
  summary: string | null;
  body: string | null;
  asset_uri: string | null;
  blurhash: string | null;
  width: number | null;
  height: number | null;
};

export async function getEntity(
  db: SQLite.SQLiteDatabase,
  entityId: string,
  r: Reveal
): Promise<EntityFull | null> {
  return db.getFirstAsync<EntityFull>(
    `SELECT e.id, e.kind, e.name, e.summary, e.body,
            a.uri AS asset_uri, a.blurhash, a.width, a.height
     FROM entity e
     LEFT JOIN asset a ON a.id = e.canon_asset
     WHERE e.id = ? AND e.reveal_key <= ?`,
    entityId,
    ceiling(r)
  );
}

/**
 * Dónde has visto a esta entidad. Es lo que Verso hace y una wiki no: te dice dónde
 * lo viste, no todo lo que llegará a ser.
 */
export async function listEntityAppearances(
  db: SQLite.SQLiteDatabase,
  entityId: string,
  r: Reveal
): Promise<{ unit_id: string; label: string; title: string | null; role: string; note: string | null }[]> {
  return db.getAllAsync(
    `SELECT u.id AS unit_id, u.label, u.title, ap.role, ap.note
     FROM appearance ap
     JOIN unit u ON u.id = ap.unit_id
     WHERE ap.entity_id = ? AND ap.reveal_key <= ?
     ORDER BY u.sort`,
    entityId,
    ceiling(r)
  );
}

export async function listEntities(
  db: SQLite.SQLiteDatabase,
  bookId: string,
  r: Reveal
): Promise<EntityFull[]> {
  return db.getAllAsync<EntityFull>(
    `SELECT e.id, e.kind, e.name, e.summary, e.body,
            a.uri AS asset_uri, a.blurhash, a.width, a.height
     FROM entity e
     LEFT JOIN asset a ON a.id = e.canon_asset
     WHERE (e.book_id = ? OR e.book_id IS NULL) AND e.reveal_key <= ?
     ORDER BY e.kind, e.name`,
    bookId,
    ceiling(r)
  );
}

// ── búsqueda ────────────────────────────────────────────────────────────────

export type Hit = { ref: string; ref_kind: string; title: string; snippet: string };

/**
 * FTS no filtra por sí mismo: se une con la tabla origen y el gate se aplica ahí.
 */
export async function search(
  db: SQLite.SQLiteDatabase,
  query: string,
  r: Reveal
): Promise<Hit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const cap = ceiling(r);
  const match = q.replace(/["*]/g, '') + '*';

  const entities = await db.getAllAsync<Hit>(
    `SELECT s.ref, s.ref_kind, s.title, snippet(search, 3, '', '', '…', 8) AS snippet
     FROM search s JOIN entity e ON e.id = s.ref
     WHERE search MATCH ? AND s.ref_kind = 'entity' AND e.reveal_key <= ?
     LIMIT 20`,
    match,
    cap
  );

  const units = await db.getAllAsync<Hit>(
    `SELECT s.ref, s.ref_kind, s.title, snippet(search, 3, '', '', '…', 8) AS snippet
     FROM search s JOIN unit u ON u.id = s.ref
     WHERE search MATCH ? AND s.ref_kind = 'unit' AND u.reveal_key <= ?
     LIMIT 20`,
    match,
    cap
  );

  return [...entities, ...units];
}

// ── ajustes ─────────────────────────────────────────────────────────────────

export async function getSetting(db: SQLite.SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM setting WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setSetting(
  db: SQLite.SQLiteDatabase,
  key: string,
  value: string
): Promise<void> {
  await db.runAsync(
    'INSERT INTO setting (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}
