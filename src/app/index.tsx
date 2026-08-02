import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as repo from '../db/repo';
import { useLayout } from '../design/layout';
import { Surface } from '../design/theme';
import { space } from '../design/tokens';
import { useApp } from '../state/app';
import {
  Hero,
  Label,
  Progress,
  Rule,
  Screen,
  SealedBar,
  SealMark,
  Section,
  T,
  Tap,
  useType,
} from '../ui/kit';

export default function Home() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useType();
  const { content } = useLayout();
  const { chrome: s, current, reveal, ready, refresh } = useApp();

  const [units, setUnits] = useState<repo.UnitRow[]>([]);
  const [books, setBooks] = useState<repo.Book[]>([]);
  const [hero, setHero] = useState<{ uri: string | null; tint: string | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        await refresh();
        const bs = await repo.listBooks(db);
        if (!alive) return;
        setBooks(bs);
        if (current) {
          const us = await repo.listUnits(db, current.book.id, reveal);
          const cards = await repo.listCards(db, current.unit.id, reveal);
          const scene = cards.find((c) => c.slot === 'hero' && c.asset) ?? cards.find((c) => c.asset);
          if (!alive) return;
          setUnits(us);
          setHero(scene?.asset ? { uri: scene.asset.uri, tint: scene.asset.blurhash } : null);
        }
      })();
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, current?.unit.id, reveal.key, reveal.unlocked])
  );

  if (!ready) {
    return (
      <Screen s={s}>
        <View />
      </Screen>
    );
  }

  if (!current) return <Empty s={s} />;

  const idx = units.findIndex((u) => u.id === current.unit.id);
  const upcoming = units.slice(Math.max(idx, 0) + 1, Math.max(idx, 0) + 5);
  const pct = current.position / Math.max(current.book.total_units, 1);

  return (
    <Screen s={s}>
      <TopBar s={s} />

      <Label s={s} style={{ marginTop: space.lg }}>
        Continúa
      </Label>
      <Rule s={s} style={{ marginBottom: space.md }} />

      <Tap onPress={() => router.push(`/unit/${current.unit.id}`)}>
        <View style={{ backgroundColor: s.elevated }}>
          <Hero uri={hero?.uri} tint={hero?.tint} width={content} s={s} />
          <View style={{ padding: space.base }}>
            <T style={t.meta} color={s.muted}>
              {current.unit.label.toUpperCase()}
            </T>
            <T style={[t.title, { marginTop: space.xs }]} color={s.ink}>
              {current.unit.title ?? current.book.title}
            </T>
            <T style={[t.caption, { marginTop: space.xs, marginBottom: space.md }]} color={s.muted}>
              {current.book.series_title}
            </T>
            <Progress pct={pct} s={s} width={content - space.base * 2} />
            <T style={[t.meta, { marginTop: space.sm }]} color={s.muted}>
              {current.position} / {current.book.total_units} · {Math.round(pct * 100)} %
            </T>
          </View>
        </View>
      </Tap>

      {upcoming.length > 0 ? (
        <Section title="Este libro" s={s}>
          {upcoming.map((u) => (
            <UnitLine key={u.id} u={u} s={s} width={content} />
          ))}
          <Tap onPress={() => router.push('/toc')} style={{ paddingVertical: space.md }}>
            <T style={t.meta} color={s.accent}>
              Índice completo →
            </T>
          </Tap>
        </Section>
      ) : null}

      <Section title="Biblioteca" s={s}>
        {books.map((b) => (
          <Tap key={b.id} onPress={() => router.push('/toc')}>
            <View style={{ paddingVertical: space.md }}>
              <T style={t.subtitle} color={s.ink}>
                {b.title}
              </T>
              <T style={t.caption} color={s.muted}>
                {b.series_title} · {b.total_units} unidades
              </T>
            </View>
            <Rule s={s} />
          </Tap>
        ))}
        <Tap onPress={() => router.push('/settings')} style={{ paddingVertical: space.md }}>
          <T style={t.meta} color={s.accent}>
            Ajustes y packs →
          </T>
        </Tap>
      </Section>
    </Screen>
  );
}

function TopBar({ s }: { s: Surface }) {
  const t = useType();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <T style={[t.label, { letterSpacing: 3 }]} color={s.ink}>
        Verso
      </T>
      <View style={{ flexDirection: 'row', gap: space.base }}>
        <Link href="/search" asChild>
          <Tap>
            <T style={t.meta} color={s.muted}>
              buscar
            </T>
          </Tap>
        </Link>
        <Link href="/settings" asChild>
          <Tap>
            <T style={t.meta} color={s.muted}>
              ajustes
            </T>
          </Tap>
        </Link>
      </View>
    </View>
  );
}

function UnitLine({ u, s, width }: { u: repo.UnitRow; s: Surface; width: number }) {
  const t = useType();
  const router = useRouter();
  return (
    <Tap onPress={() => (u.sealed ? undefined : router.push(`/unit/${u.id}`))} disabled={u.sealed}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: space.md,
          gap: space.md,
          opacity: u.sealed ? 0.55 : 1,
        }}
      >
        <T style={[t.numeral, { width: 42 }]} color={s.muted}>
          {u.label}
        </T>
        <View style={{ flex: 1 }}>
          {u.sealed ? (
            <SealedBar s={s} width={Math.min(width * 0.42, 150)} />
          ) : (
            <T style={t.subtitle} color={s.ink} numberOfLines={1}>
              {u.title ?? kindLabel(u.kind)}
            </T>
          )}
        </View>
        {u.sealed ? (
          <SealMark s={s} />
        ) : (
          <T style={t.meta} color={s.muted}>
            ›
          </T>
        )}
      </View>
      <Rule s={s} />
    </Tap>
  );
}

export function kindLabel(kind: string) {
  switch (kind) {
    case 'prelude':
      return 'Preludio';
    case 'prologue':
      return 'Prólogo';
    case 'interlude':
      return 'Interludio';
    case 'epilogue':
      return 'Epílogo';
    case 'appendix':
      return 'Apéndice';
    default:
      return 'Capítulo';
  }
}

function Empty({ s }: { s: Surface }) {
  const t = useType();
  const router = useRouter();
  return (
    <Screen s={s}>
      <TopBar s={s} />
      <View style={{ marginTop: space.xxxl }}>
        <T style={t.title} color={s.ink}>
          Todavía no hay ningún libro.
        </T>
        <T style={[t.body, { marginTop: space.md }]} color={s.muted}>
          Verso lee packs: un libro, sus capítulos y el mundo que hay dentro. Carga uno para
          empezar.
        </T>
        <Tap onPress={() => router.push('/settings')} style={{ marginTop: space.lg }}>
          <View
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: s.ink,
              paddingVertical: space.md,
              paddingHorizontal: space.base,
              alignSelf: 'flex-start',
            }}
          >
            <T style={t.label} color={s.ink}>
              Cargar un pack
            </T>
          </View>
        </Tap>
      </View>
    </Screen>
  );
}
