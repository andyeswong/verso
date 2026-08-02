/** Formato del pack. Ver ARQUITECTURA.md §4. */

export type PackTheme = {
  paper?: string;
  elevated?: string;
  ink?: string;
  muted?: string;
  rule?: string;
  accent?: string;
  sealed?: string;
};

export type PackManifest = {
  id: string;
  /** versión del FORMATO — el importador rechaza lo que no entiende */
  schema: number;
  /** versión del CONTENIDO */
  version: string;
  title: string;
  language?: string;
  authors?: string[];
  license?: string;
  theme?: PackTheme;
  books: string[]; // directorios bajo books/
};

export type PackSeries = {
  id: string;
  title: string;
  author?: string;
  sort?: number;
};

export type PackBook = {
  id: string;
  series: PackSeries;
  title: string;
  number: number;
  cover?: string; // id de asset
  parts?: { id: string; title?: string; number?: number; sort?: number }[];
};

export type PackUnit = {
  id: string;
  kind: 'prelude' | 'prologue' | 'chapter' | 'interlude' | 'epilogue' | 'appendix';
  number?: number;
  label: string;
  title?: string;
  part?: string;
  pov?: string;
  epigraph?: string;
  epigraph_src?: string;
  sort: number;
  timeline_at?: number;
};

export type PackAsset = {
  id: string;
  kind: 'image' | 'video';
  file: string; // relativo a media/
  width: number;
  height: number;
  tint?: string; // color medio, placeholder sin dependencias
  blurhash?: string;
  duration_ms?: number;
  caption?: string;
  credit?: string;
  prompt?: string;
  tool?: string;
  seed?: string;
  reveal?: string; // id de unidad
};

export type PackEntity = {
  id: string;
  kind: 'character' | 'place' | 'concept' | 'faction' | 'item' | 'creature' | 'event';
  name: string;
  aka?: string[];
  summary?: string;
  body?: string;
  canon_asset?: string;
  accent?: string;
  reveal?: string; // id de unidad; omitido = siempre visible
  appearances?: {
    unit: string;
    role: 'introduced' | 'appears' | 'mentioned' | 'pov';
    note?: string;
    reveal?: string;
  }[];
  relations?: { to: string; kind: string; label?: string; reveal?: string }[];
};

export type PackCard = {
  kind: 'scene' | 'note' | 'quote' | 'entity_ref' | 'media' | 'map';
  slot?: 'hero' | 'body' | 'aside';
  title?: string;
  body?: string;
  asset?: string;
  ref?: string; // entity id
  reveal?: string;
};

export type PackCards = { unit: string; cards: PackCard[] };
