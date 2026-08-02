/**
 * Verso — orígenes de pack.
 *
 * Dos caminos hacia el mismo importador:
 *   http    · una carpeta servida por HTTP. Para iterar desde la laptop.
 *   folder  · una carpeta del dispositivo, elegida una vez con permiso persistente.
 *             Es la que sincroniza Syncthing, y la única que funciona sin red.
 *
 * En los dos casos la media termina COPIADA dentro del almacenamiento de la app:
 * el origen es el cartero, no el almacén (ARQUITECTURA.md §4.8).
 */
import { Directory, File } from 'expo-file-system';

export type PackSource = {
  kind: 'http' | 'folder';
  /** lo que se le enseña al usuario */
  label: string;
  /** identificador estable para volver a importar */
  ref: string;
  readJson<T>(...segments: string[]): Promise<T>;
  /** copia un archivo de media/ al destino dentro de la app */
  fetchMedia(name: string, dest: File): Promise<void>;
};

// ── http ────────────────────────────────────────────────────────────────────

export function httpSource(baseUrl: string): PackSource {
  const base = baseUrl.trim().replace(/\/$/, '');
  return {
    kind: 'http',
    label: base,
    ref: base,
    async readJson<T>(...segments: string[]): Promise<T> {
      const url = `${base}/${segments.join('/')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} en ${segments.join('/')}`);
      return (await res.json()) as T;
    },
    async fetchMedia(name: string, dest: File): Promise<void> {
      const res = await fetch(`${base}/media/${name}`);
      if (!res.ok) throw new Error(`${res.status} bajando ${name}`);
      const buf = await res.arrayBuffer();
      if (dest.exists) dest.delete();
      dest.create();
      dest.write(new Uint8Array(buf));
    },
  };
}

// ── carpeta del dispositivo ─────────────────────────────────────────────────

/**
 * El último segmento de un URI, decodificado. Con SAF el URI es un content://
 * cuyo documentId trae la ruta entera separada por %2F, así que hay que cortar
 * por barra Y por dos puntos. Se usa como respaldo de `.name`, que sobre content://
 * no siempre viene.
 */
function baseName(uri: string): string {
  let s = uri;
  try {
    s = decodeURIComponent(uri);
  } catch {
    /* uri ya decodificado */
  }
  s = s.replace(/\/$/, '');
  const afterSlash = s.slice(s.lastIndexOf('/') + 1);
  return afterSlash.slice(afterSlash.lastIndexOf(':') + 1);
}

type Entry = Directory | File;

function isDir(e: Entry): e is Directory {
  return e instanceof Directory;
}

function nameOf(entry: Entry): string {
  return entry.name || baseName(entry.uri);
}

function childrenOf(dir: Directory): Map<string, Entry> {
  const map = new Map<string, Entry>();
  for (const entry of dir.list()) map.set(nameOf(entry), entry);
  return map;
}

/**
 * Resuelve una ruta relativa navegando nivel por nivel. No se construyen URIs a
 * mano: con content:// concatenar segmentos no da un documento válido.
 */
function walk(root: Directory, segments: string[]): Entry {
  let dir = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const next = childrenOf(dir).get(segments[i]);
    if (!next || !isDir(next)) throw new Error(`no existe la carpeta "${segments[i]}"`);
    dir = next;
  }
  const leaf = childrenOf(dir).get(segments[segments.length - 1]);
  if (!leaf) throw new Error(`no existe "${segments.join('/')}"`);
  return leaf;
}

export function folderSource(root: Directory): PackSource {
  // El listado de media/ se cachea: son decenas de archivos y list() sobre SAF
  // no es barato.
  let media: Map<string, Entry> | null = null;

  return {
    kind: 'folder',
    label: nameOf(root) || 'carpeta del dispositivo',
    ref: root.uri,

    async readJson<T>(...segments: string[]): Promise<T> {
      const leaf = walk(root, segments);
      if (isDir(leaf)) throw new Error(`"${segments.join('/')}" es una carpeta`);
      return JSON.parse(await leaf.text()) as T;
    },

    async fetchMedia(name: string, dest: File): Promise<void> {
      if (!media) {
        const dir = childrenOf(root).get('media');
        if (!dir || !isDir(dir)) throw new Error('el pack no tiene carpeta media/');
        media = childrenOf(dir);
      }
      const src = media.get(name);
      if (!src || isDir(src)) throw new Error(`falta media/${name}`);
      if (dest.exists) dest.delete();
      // copy() atraviesa content:// → file:// sin pasar el binario por JS.
      (src as File).copy(dest);
    },
  };
}

/**
 * Abre el selector de carpetas del sistema. En Android concede permiso
 * persistente sobre el árbol elegido, así que se pide UNA vez y las
 * reimportaciones posteriores no vuelven a preguntar.
 */
export async function pickFolderSource(): Promise<PackSource> {
  // pickDirectoryAsync está tipado contra la clase interna del módulo nativo, que
  // no declara los getters `name` / `parentDirectory` de la clase pública. En
  // runtime es la misma instancia.
  const dir = (await Directory.pickDirectoryAsync()) as unknown as Directory;
  return folderSource(dir);
}
