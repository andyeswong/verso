/**
 * Verso — adaptación.
 *
 * El ancho objetivo NO es un teléfono: es el cuarto de tablet que queda al lado del
 * Kindle (~320 dp). Ver ARQUITECTURA.md §6.6.
 *
 * useWindowDimensions y nunca Dimensions.get: el split-screen se redimensiona
 * arrastrando el divisor, en vivo.
 */
import { useWindowDimensions } from 'react-native';

export type Size = 'compact' | 'regular' | 'wide' | 'full';

export type Layout = {
  size: Size;
  width: number;
  height: number;
  /** margen lateral del contenido */
  gutter: number;
  /** ancho útil = width - gutter*2 */
  content: number;
  /** multiplicador de la escala tipográfica */
  scale: number;
};

export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();

  let size: Size;
  if (width < 400) size = 'compact';
  else if (width < 640) size = 'regular';
  else if (width < 900) size = 'wide';
  else size = 'full';

  // Escalón por breakpoint, no interpolación lineal con el ancho.
  const gutter = size === 'compact' ? 16 : size === 'regular' ? 20 : size === 'wide' ? 40 : 56;
  const scale = size === 'compact' ? 1 : size === 'regular' ? 1.04 : 1.1;

  // En 'wide' y 'full' crece el margen, NO se parte en dos columnas: la columna de
  // lectura tiene un ancho cómodo máximo y por encima de eso sólo respira.
  const maxContent = 560;
  const content = Math.min(width - gutter * 2, maxContent);

  return { size, width, height, gutter, content, scale };
}
