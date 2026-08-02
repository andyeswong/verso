/**
 * Verso — temas.
 *
 * Dos capas, ver ARQUITECTURA.md §6.4:
 *   chrome  → sigue el tema del sistema (home, índice, biblioteca, búsqueda, ajustes)
 *   canvas  → tono propio del pack, independiente del sistema (unidad, entidad)
 *
 * Una imagen atmosférica oscura sobre papel claro se ve como una calcomanía pegada,
 * y no habrá dos sets de assets. La oscuridad es contenido, no tema.
 */

export type Surface = {
  paper: string;
  elevated: string;
  ink: string;
  muted: string;
  rule: string;
  accent: string;
  /** fondo de lo sellado */
  sealed: string;
};

export const chromeLight: Surface = {
  paper: '#F7F5F0',
  elevated: '#FFFFFF',
  ink: '#14120E',
  muted: '#6E6A60',
  rule: '#DDD8CC',
  accent: '#9A5B1E',
  sealed: '#E8E3D8',
};

export const chromeDark: Surface = {
  paper: '#111110',
  elevated: '#1A1917',
  ink: '#EDEAE3',
  muted: '#8B857A',
  rule: '#2B2926',
  accent: '#C9903F',
  sealed: '#1F1E1B',
};

/** Fallback del canvas cuando el pack no declara tema. */
export const canvasDefault: Surface = {
  paper: '#0B0E14',
  elevated: '#12161F',
  ink: '#E8E4DC',
  muted: '#8A8578',
  rule: '#232833',
  accent: '#C9A227',
  sealed: '#171B24',
};

export type PackTheme = Partial<
  Pick<Surface, 'paper' | 'elevated' | 'ink' | 'muted' | 'rule' | 'accent' | 'sealed'>
>;

export function canvasFromPack(theme: PackTheme | null | undefined): Surface {
  if (!theme) return canvasDefault;
  return { ...canvasDefault, ...theme };
}

/** Acepta el ColorSchemeName de RN tal cual, incluido 'unspecified'. */
export function chromeFor(scheme: string | null | undefined): Surface {
  return scheme === 'dark' ? chromeDark : chromeLight;
}
