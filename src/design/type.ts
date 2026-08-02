import { TextStyle } from 'react-native';
import { fonts } from './tokens';

/**
 * Escala tipográfica. El multiplicador viene del breakpoint (layout.ts), no del
 * ancho interpolado. maxFontSizeMultiplier acota el font-scaling del sistema para
 * que un titular no reviente el layout.
 */
export function type(scale: number) {
  const s = (n: number) => Math.round(n * scale);

  const display: TextStyle = {
    fontFamily: fonts.display,
    fontSize: s(52),
    lineHeight: s(56),
    letterSpacing: -1,
  };

  const title: TextStyle = {
    fontFamily: fonts.serifSemi,
    fontSize: s(22),
    lineHeight: s(28),
    letterSpacing: -0.2,
  };

  const subtitle: TextStyle = {
    fontFamily: fonts.serifMedium,
    fontSize: s(18),
    lineHeight: s(24),
  };

  /** El texto que de verdad se lee. Interlineado generoso: es prosa, no UI. */
  const body: TextStyle = {
    fontFamily: fonts.serif,
    fontSize: s(17),
    lineHeight: s(27),
  };

  const bodySmall: TextStyle = {
    fontFamily: fonts.serif,
    fontSize: s(15),
    lineHeight: s(23),
  };

  const quote: TextStyle = {
    fontFamily: fonts.serifItalic,
    fontSize: s(15),
    lineHeight: s(24),
  };

  const caption: TextStyle = {
    fontFamily: fonts.serif,
    fontSize: s(12),
    lineHeight: s(17),
  };

  /** Labels de sección. Mono en caps con tracking: registro menor, no decorativo. */
  const label: TextStyle = {
    fontFamily: fonts.monoMedium,
    fontSize: s(10),
    lineHeight: s(14),
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  };

  const meta: TextStyle = {
    fontFamily: fonts.mono,
    fontSize: s(11),
    lineHeight: s(16),
    letterSpacing: 0.2,
  };

  const numeral: TextStyle = {
    fontFamily: fonts.mono,
    fontSize: s(13),
    lineHeight: s(18),
    letterSpacing: 0.5,
  };

  return { display, title, subtitle, body, bodySmall, quote, caption, label, meta, numeral };
}

export const MAX_SCALE = 1.25;
