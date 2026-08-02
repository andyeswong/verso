/**
 * Verso — tokens base.
 * Ver ARQUITECTURA.md §6. Radius 0 en todo, sin excepción.
 */

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const radius = 0;

export const hairline = 1;

/** Duraciones. La app corre al lado del libro: nada pide atención. */
export const motion = {
  micro: 120,
  standard: 180,
} as const;

/** Relación de aspecto canónica de la media. Nunca 16:9. */
export const ASPECT = 4 / 5;

export const fonts = {
  display: 'Newsreader-Display',
  serif: 'Newsreader-Regular',
  serifMedium: 'Newsreader-Medium',
  serifSemi: 'Newsreader-SemiBold',
  serifItalic: 'Newsreader-Italic',
  mono: 'MartianMono-Regular',
  monoMedium: 'MartianMono-Medium',
} as const;
