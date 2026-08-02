/**
 * Verso — importador de packs.
 *
 * Reglas (ARQUITECTURA.md §4.7):
 *   · valida TODAS las referencias antes de descargar un solo byte de media
 *   · transaccional: si algo falla, la base queda como estaba
 *   · progress / user_note / user_media quedan INTACTOS al actualizar un pack
 *   · la media se copia al almacén de la app: el transporte no es el almacén
 */
import { Directory, File, Paths } from 'expo-file-system';
import type * as SQLite from 'expo-sqlite';
import { revealKeyOf } from '../db/repo';
import type { PackSource } from './source';
import type {
  PackAsset,
  PackBook,
  PackCards,
  PackEntity,
  PackManifest,
  PackUnit,
} from './types';

export const SUPPORTED_SCHEMA = 1;

export type Progress = (msg: string, pct: number) => void;

type BookBundle = {
  dir: string;
  book: PackBook;
  units: PackUnit[];
  entities: PackEntity[];
  assets: PackAsset[];
  cards: PackCards[];
};

async function optional<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

function packDir(packId: string): Directory {
  return new Directory(Paths.document, 'packs', packId);
}

/** Nombre de archivo seguro dentro del almacén de la app. */
function safeName(file: string): string {
  return file.replace(/[^\w.\-]/g, '_');
}

export async function importPack(
  db: SQLite.SQLiteDatabase,
  source: PackSource,
  onProgress: Progress = () => {}
): Promise<{ packId: string; assets: number; units: number }> {
  // ── 1 · manifiesto ────────────────────────────────────────────────────
  onProgress('Leyendo el manifiesto', 0.02);
  const manifest = await source.readJson<PackManifest>('pack.json');

  if (manifest.schema !== SUPPORTED_SCHEMA) {
    throw new Error(
      `El pack usa formato ${manifest.schema} y esta versión entiende ${SUPPORTED_SCHEMA}.`
    );
  }

  // ── 2 · metadatos ─────────────────────────────────────────────────────
  onProgress('Leyendo el contenido', 0.06);
  const bundles: BookBundle[] = [];
  for (const dir of manifest.books) {
    const at = (f: string) => ['books', dir, f];
    bundles.push({
      dir,
      book: await source.readJson<PackBook>(...at('book.json')),
      units: await source.readJson<PackUnit[]>(...at('units.json')),
      entities: await optional(source.readJson<PackEntity[]>(...at('entities.json')), []),
      assets: await optional(source.readJson<PackAsset[]>(...at('assets.json')), []),
      cards: await optional(source.readJson<PackCards[]>(...at('cards.json')), []),
    });
  }

  // ── 3 · validación · ANTES de copiar un solo byte de media ─────────────
  onProgress('Validando referencias', 0.1);
  const problems: string[] = [];

  for (const b of bundles) {
    const unitIds = new Set(b.units.map((u) => u.id));
    const assetIds = new Set(b.assets.map((a) => a.id));
    const entityIds = new Set(b.entities.map((e) => e.id));
    const partIds = new Set((b.book.parts ?? []).map((p) => p.id));

    if (b.units.length === 0) problems.push(`${b.dir}: no tiene unidades`);

    for (const u of b.units) {
      if (u.part && !partIds.has(u.part)) problems.push(`unidad ${u.id}: parte "${u.part}" no existe`);
    }
    const seen = new Set<number>();
    for (const u of b.units) {
      if (seen.has(u.sort)) problems.push(`sort duplicado ${u.sort} en ${b.dir}`);
      seen.add(u.sort);
    }
    for (const a of b.assets) {
      if (a.reveal && !unitIds.has(a.reveal)) problems.push(`asset ${a.id}: reveal "${a.reveal}" no existe`);
    }
    for (const e of b.entities) {
      if (e.reveal && !unitIds.has(e.reveal)) problems.push(`entidad ${e.id}: reveal "${e.reveal}" no existe`);
      if (e.canon_asset && !assetIds.has(e.canon_asset))
        problems.push(`entidad ${e.id}: asset "${e.canon_asset}" no existe`);
      for (const ap of e.appearances ?? []) {
        if (!unitIds.has(ap.unit)) problems.push(`aparición de ${e.id}: unidad "${ap.unit}" no existe`);
      }
      for (const rel of e.relations ?? []) {
        if (!entityIds.has(rel.to)) problems.push(`relación de ${e.id}: entidad "${rel.to}" no existe`);
      }
    }
    for (const cs of b.cards) {
      if (!unitIds.has(cs.unit)) problems.push(`cards: unidad "${cs.unit}" no existe`);
      for (const c of cs.cards) {
        if (c.asset && !assetIds.has(c.asset)) problems.push(`card en ${cs.unit}: asset "${c.asset}" no existe`);
        if (c.ref && !entityIds.has(c.ref)) problems.push(`card en ${cs.unit}: entidad "${c.ref}" no existe`);
        if (c.reveal && !unitIds.has(c.reveal)) problems.push(`card en ${cs.unit}: reveal "${c.reveal}" no existe`);
      }
    }
    if (b.book.cover && !assetIds.has(b.book.cover))
      problems.push(`libro ${b.book.id}: portada "${b.book.cover}" no existe`);
  }

  if (problems.length) {
    throw new Error(`El pack tiene ${problems.length} problema(s):\n· ${problems.slice(0, 8).join('\n· ')}`);
  }

  // ── 4 · media ─────────────────────────────────────────────────────────
  const dir = packDir(manifest.id);
  dir.create({ idempotent: true, intermediates: true });

  const allAssets = bundles.flatMap((b) => b.assets);
  let done = 0;
  for (const a of allAssets) {
    const dest = new File(dir, safeName(a.file));
    if (!dest.exists) {
      await source.fetchMedia(a.file, dest);
    }
    done += 1;
    onProgress(`Guardando media ${done}/${allAssets.length}`, 0.15 + 0.7 * (done / Math.max(allAssets.length, 1)));
  }

  const uriOf = (a: PackAsset) => new File(dir, safeName(a.file)).uri;

  // ── 5 · escritura, transaccional ──────────────────────────────────────
  onProgress('Escribiendo la base', 0.9);
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    // Reemplaza el contenido del pack. Cascade limpia lo suyo; progress,
    // user_note y user_media no dependen del pack y quedan en pie.
    await db.runAsync('DELETE FROM pack WHERE id = ?', manifest.id);
    await db.runAsync(
      `INSERT INTO pack (id, version, schema, title, language, theme, source_uri, installed_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      manifest.id,
      manifest.version,
      manifest.schema,
      manifest.title,
      manifest.language ?? null,
      manifest.theme ? JSON.stringify(manifest.theme) : null,
      source.ref,
      now,
      now
    );

    await db.runAsync("DELETE FROM search WHERE ref_kind IN ('unit','entity')");

    for (const b of bundles) {
      const s = b.book.series;
      await db.runAsync(
        'INSERT OR REPLACE INTO series (id, pack_id, title, author, sort) VALUES (?,?,?,?,?)',
        s.id,
        manifest.id,
        s.title,
        s.author ?? null,
        s.sort ?? 0
      );

      // reveal_key: entero global comparable. El pack habla en ids de unidad.
      const keyOfUnit = new Map<string, number>();
      for (const u of b.units) keyOfUnit.set(u.id, revealKeyOf(b.book.number, u.sort));
      const key = (unitId?: string) => (unitId ? keyOfUnit.get(unitId) ?? 0 : 0);

      // assets primero: book.cover y entity.canon_asset los referencian
      for (const a of b.assets) {
        await db.runAsync(
          `INSERT OR REPLACE INTO asset
             (id, pack_id, kind, uri, width, height, blurhash, duration_ms, caption, credit, prompt, tool, seed, reveal_key)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          a.id,
          manifest.id,
          a.kind,
          uriOf(a),
          a.width,
          a.height,
          a.blurhash ?? a.tint ?? null,
          a.duration_ms ?? null,
          a.caption ?? null,
          a.credit ?? null,
          a.prompt ?? null,
          a.tool ?? null,
          a.seed ?? null,
          key(a.reveal)
        );
      }

      await db.runAsync(
        'INSERT OR REPLACE INTO book (id, series_id, pack_id, title, number, cover_asset, sort) VALUES (?,?,?,?,?,?,?)',
        b.book.id,
        s.id,
        manifest.id,
        b.book.title,
        b.book.number,
        b.book.cover ?? null,
        b.book.number
      );

      for (const p of b.book.parts ?? []) {
        await db.runAsync(
          'INSERT OR REPLACE INTO part (id, book_id, title, number, sort) VALUES (?,?,?,?,?)',
          p.id,
          b.book.id,
          p.title ?? null,
          p.number ?? null,
          p.sort ?? p.number ?? 0
        );
      }

      for (const u of b.units) {
        await db.runAsync(
          `INSERT OR REPLACE INTO unit
             (id, book_id, part_id, kind, number, label, title, epigraph, epigraph_src, pov, sort, timeline_at, reveal_key)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          u.id,
          b.book.id,
          u.part ?? null,
          u.kind,
          u.number ?? null,
          u.label,
          u.title ?? null,
          u.epigraph ?? null,
          u.epigraph_src ?? null,
          u.pov ?? null,
          u.sort,
          u.timeline_at ?? u.sort,
          keyOfUnit.get(u.id)!
        );
        await db.runAsync(
          'INSERT INTO search (ref, ref_kind, title, body) VALUES (?,?,?,?)',
          u.id,
          'unit',
          `${u.label} ${u.title ?? ''}`.trim(),
          u.epigraph ?? ''
        );
      }

      for (const e of b.entities) {
        await db.runAsync(
          `INSERT OR REPLACE INTO entity
             (id, pack_id, book_id, kind, name, aka, summary, body, canon_asset, accent, reveal_key)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          e.id,
          manifest.id,
          b.book.id,
          e.kind,
          e.name,
          e.aka ? JSON.stringify(e.aka) : null,
          e.summary ?? null,
          e.body ?? null,
          e.canon_asset ?? null,
          e.accent ?? null,
          key(e.reveal)
        );
        await db.runAsync(
          'INSERT INTO search (ref, ref_kind, title, body) VALUES (?,?,?,?)',
          e.id,
          'entity',
          [e.name, ...(e.aka ?? [])].join(' '),
          [e.summary, e.body].filter(Boolean).join(' ')
        );

      }

      // Segunda pasada: apariciones y relaciones apuntan a entidades que pueden
      // aparecer más adelante en el archivo. Con foreign_keys ON, insertarlas
      // dentro del bucle anterior revienta en la primera relación hacia adelante.
      for (const e of b.entities) {
        for (const ap of e.appearances ?? []) {
          await db.runAsync(
            'INSERT OR REPLACE INTO appearance (id, entity_id, unit_id, role, note, reveal_key) VALUES (?,?,?,?,?,?)',
            `${e.id}@${ap.unit}`,
            e.id,
            ap.unit,
            ap.role,
            ap.note ?? null,
            key(ap.reveal ?? ap.unit)
          );
        }
        for (const rel of e.relations ?? []) {
          await db.runAsync(
            'INSERT OR REPLACE INTO relation (id, from_id, to_id, kind, label, reveal_key) VALUES (?,?,?,?,?,?)',
            `${e.id}->${rel.to}:${rel.kind}`,
            e.id,
            rel.to,
            rel.kind,
            rel.label ?? null,
            key(rel.reveal)
          );
        }
      }

      for (const cs of b.cards) {
        let i = 0;
        for (const c of cs.cards) {
          await db.runAsync(
            `INSERT OR REPLACE INTO card
               (id, pack_id, unit_id, entity_id, kind, slot, title, body, asset_id, ref_entity, sort, reveal_key)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
            `${cs.unit}#${i}`,
            manifest.id,
            cs.unit,
            null,
            c.kind,
            c.slot ?? (c.kind === 'scene' ? 'hero' : 'body'),
            c.title ?? null,
            c.body ?? null,
            c.asset ?? null,
            c.ref ?? null,
            i,
            key(c.reveal ?? cs.unit)
          );
          i += 1;
        }
      }
    }
  });

  onProgress('Listo', 1);

  return {
    packId: manifest.id,
    assets: allAssets.length,
    units: bundles.reduce((n, b) => n + b.units.length, 0),
  };
}

export function packStorageSize(packId: string): number {
  const dir = packDir(packId);
  if (!dir.exists) return 0;
  let total = 0;
  for (const entry of dir.list()) {
    if (entry instanceof File) total += entry.size ?? 0;
  }
  return total;
}
