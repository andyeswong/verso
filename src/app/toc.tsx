import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as repo from '../db/repo';
import { useLayout } from '../design/layout';
import { space } from '../design/tokens';
import { useApp } from '../state/app';
import { Label, Rule, Screen, SealedBar, SealMark, T, Tap, useType } from '../ui/kit';
import { kindLabel } from './index';

/**
 * Índice. 87 unidades no caben en un selector de rueda: lista agrupada por partes,
 * con los interludios como bloque propio, y salto directo. Tocar una unidad ya
 * alcanzada mueve el progreso ahí — el progreso es manual (Kindle no expone nada).
 */
export default function Toc() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useType();
  const { content } = useLayout();
  const { chrome: s, current, reveal, advance } = useApp();

  const [units, setUnits] = useState<repo.UnitRow[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!current) return;
      const us = await repo.listUnits(db, current.book.id, reveal);
      if (alive) setUnits(us);
    })();
    return () => {
      alive = false;
    };
  }, [db, current?.book.id, reveal.key, reveal.unlocked]);

  if (!current) {
    return (
      <Screen s={s}>
        <View />
      </Screen>
    );
  }

  // Agrupado por parte; los interludios rompen el grupo y forman el suyo.
  const groups: { title: string; units: repo.UnitRow[] }[] = [];
  for (const u of units) {
    const key = u.kind === 'interlude' ? 'Interludios' : u.part_title ?? 'Sin parte';
    const last = groups[groups.length - 1];
    if (last && last.title === key) last.units.push(u);
    else groups.push({ title: key, units: [u] });
  }

  return (
    <Screen s={s}>
      <Tap onPress={() => router.back()}>
        <T style={t.meta} color={s.muted}>
          ‹ volver
        </T>
      </Tap>

      <View style={{ marginTop: space.lg }}>
        <T style={t.title} color={s.ink}>
          {current.book.title}
        </T>
        <T style={t.caption} color={s.muted}>
          {current.book.series_title}
        </T>
      </View>

      {groups.map((g, gi) => (
        <View key={`${g.title}-${gi}`} style={{ marginTop: space.xl }}>
          <Label s={s}>{g.title}</Label>
          <Rule s={s} style={{ marginBottom: space.sm }} />
          {g.units.map((u) => {
            const isHere = u.id === current.unit.id;
            return (
              <Tap
                key={u.id}
                disabled={u.sealed}
                onPress={async () => {
                  await advance(u.id);
                  router.replace(`/unit/${u.id}`);
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.md,
                    paddingVertical: space.md,
                    opacity: u.sealed ? 0.5 : 1,
                  }}
                >
                  <View style={{ width: 3, height: 18, backgroundColor: isHere ? s.accent : 'transparent' }} />
                  <T style={[t.numeral, { width: 42 }]} color={isHere ? s.accent : s.muted}>
                    {u.label}
                  </T>
                  <View style={{ flex: 1 }}>
                    {u.sealed ? (
                      <SealedBar s={s} width={Math.min(content * 0.4, 140)} />
                    ) : (
                      <T style={t.bodySmall} color={s.ink} numberOfLines={1}>
                        {u.title ?? kindLabel(u.kind)}
                      </T>
                    )}
                  </View>
                  {u.sealed ? <SealMark s={s} /> : null}
                </View>
                <Rule s={s} />
              </Tap>
            );
          })}
        </View>
      ))}
    </Screen>
  );
}
