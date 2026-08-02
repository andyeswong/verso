import { Image } from 'expo-image';
import { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../design/layout';
import { Surface } from '../design/theme';
import { MAX_SCALE, type as typeScale } from '../design/type';
import { ASPECT, space } from '../design/tokens';

export function useType() {
  const { scale } = useLayout();
  return typeScale(scale);
}

// ── texto ───────────────────────────────────────────────────────────────────

type TxtProps = {
  children: ReactNode;
  style?: TextStyle | TextStyle[];
  color?: string;
  numberOfLines?: number;
};

export function T({ children, style, color, numberOfLines }: TxtProps) {
  return (
    <Text
      maxFontSizeMultiplier={MAX_SCALE}
      numberOfLines={numberOfLines}
      style={[color ? { color } : null, style]}
    >
      {children}
    </Text>
  );
}

export function Label({ children, s, style }: { children: ReactNode; s: Surface; style?: ViewStyle }) {
  const t = useType();
  return (
    <View style={[{ marginBottom: space.sm }, style]}>
      <T style={t.label} color={s.muted}>
        {children}
      </T>
    </View>
  );
}

/** Regla de 1 px. Nunca sombras. */
export function Rule({ s, style }: { s: Surface; style?: ViewStyle }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: s.rule }, style]} />;
}

export function Section({
  title,
  s,
  children,
  style,
}: {
  title: string;
  s: Surface;
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[{ marginTop: space.xl }, style]}>
      <Label s={s}>{title}</Label>
      <Rule s={s} style={{ marginBottom: space.md }} />
      {children}
    </View>
  );
}

// ── pantalla ────────────────────────────────────────────────────────────────

export function Screen({
  s,
  children,
  scroll = true,
  footer,
}: {
  s: Surface;
  children: ReactNode;
  scroll?: boolean;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { gutter, content, width } = useLayout();
  // Contenido centrado cuando la pantalla es más ancha que la columna de lectura:
  // en 'wide'/'full' crece el margen, no se parte en dos columnas.
  const side = Math.max(gutter, (width - content) / 2);

  const inner = (
    <View style={{ paddingHorizontal: side, paddingTop: insets.top + space.md }}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: s.paper }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: (footer ? 0 : insets.bottom) + space.xxxl }}
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
      {footer ? (
        <View
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: s.rule,
            backgroundColor: s.paper,
            paddingBottom: insets.bottom,
            paddingHorizontal: side,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

// ── media ───────────────────────────────────────────────────────────────────

/**
 * Una imagen a escala real o ninguna. Nunca rejillas de miniaturas: en 320 dp son
 * confeti (ARQUITECTURA.md §6.3).
 */
export function Hero({
  uri,
  tint,
  width,
  s,
  caption,
}: {
  uri?: string | null;
  tint?: string | null;
  width: number;
  s: Surface;
  caption?: string | null;
}) {
  const t = useType();
  const h = Math.round(width / ASPECT);
  return (
    <View>
      <View style={{ width, height: h, backgroundColor: tint ?? s.elevated }}>
        {uri ? (
          <Image
            source={{ uri }}
            style={{ width, height: h }}
            contentFit="cover"
            transition={180}
          />
        ) : null}
      </View>
      {caption ? (
        <T style={[t.caption, { marginTop: space.sm }]} color={s.muted}>
          {caption}
        </T>
      ) : null}
    </View>
  );
}

export function Thumb({
  uri,
  tint,
  size,
  s,
}: {
  uri?: string | null;
  tint?: string | null;
  size: number;
  s: Surface;
}) {
  return (
    <View style={{ width: size, height: size, backgroundColor: tint ?? s.sealed }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" /> : null}
    </View>
  );
}

// ── sellado ─────────────────────────────────────────────────────────────────

/**
 * Lo que aún no alcanzas: se ve que existe, no qué es. Un marcador cuadrado, sin
 * candado ni icono de alarma — no es contenido bloqueado, es contenido que todavía
 * no ocurrió.
 */
export function SealMark({ s }: { s: Surface }) {
  return <View style={{ width: 6, height: 6, backgroundColor: s.muted, opacity: 0.55 }} />;
}

export function SealedBar({ s, width }: { s: Surface; width: number }) {
  return <View style={{ width, height: 10, backgroundColor: s.sealed }} />;
}

// ── táctil ──────────────────────────────────────────────────────────────────

export function Tap({
  onPress,
  children,
  style,
  disabled,
}: {
  onPress?: () => void;
  children: ReactNode;
  style?: ViewStyle;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [style, pressed && !disabled ? { opacity: 0.62 } : null]}
      hitSlop={6}
    >
      {children}
    </Pressable>
  );
}

/** Barra de progreso de 2 px. Sin radius, sin gradiente. */
export function Progress({ pct, s, width }: { pct: number; s: Surface; width: number }) {
  return (
    <View style={{ width, height: 2, backgroundColor: s.rule }}>
      <View
        style={{
          width: Math.max(2, Math.round(width * Math.min(Math.max(pct, 0), 1))),
          height: 2,
          backgroundColor: s.accent,
        }}
      />
    </View>
  );
}
