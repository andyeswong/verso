import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as repo from '../../db/repo';
import { useLayout } from '../../design/layout';
import { space } from '../../design/tokens';
import { useApp } from '../../state/app';
import { Hero, Rule, Screen, Section, T, Tap, useType } from '../../ui/kit';

const KIND: Record<string, string> = {
  character: 'personaje',
  place: 'lugar',
  concept: 'concepto',
  faction: 'facción',
  item: 'objeto',
  creature: 'criatura',
  event: 'suceso',
};

export default function EntityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useType();
  const { content } = useLayout();
  const { canvas: s, reveal } = useApp();

  const [e, setE] = useState<repo.EntityFull | null>(null);
  const [seen, setSeen] = useState<
    { unit_id: string; label: string; title: string | null; role: string; note: string | null }[]
  >([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const got = await repo.getEntity(db, id, reveal);
      if (!alive) return;
      setE(got);
      if (got) setSeen(await repo.listEntityAppearances(db, id, reveal));
    })();
    return () => {
      alive = false;
    };
  }, [db, id, reveal.key, reveal.unlocked]);

  if (!e) {
    return (
      <Screen s={s}>
        <View />
      </Screen>
    );
  }

  return (
    <Screen s={s}>
      <Tap onPress={() => router.back()}>
        <T style={t.meta} color={s.muted}>
          ‹ volver
        </T>
      </Tap>

      {e.asset_uri ? (
        <View style={{ marginTop: space.lg }}>
          <Hero uri={e.asset_uri} tint={e.blurhash} width={content} s={s} />
        </View>
      ) : null}

      <View style={{ marginTop: space.lg }}>
        <T style={t.label} color={s.accent}>
          {KIND[e.kind] ?? e.kind}
        </T>
        <T style={[t.title, { marginTop: space.xs }]} color={s.ink}>
          {e.name}
        </T>
        {e.summary ? (
          <T style={[t.bodySmall, { marginTop: space.sm }]} color={s.muted}>
            {e.summary}
          </T>
        ) : null}
      </View>

      {e.body ? (
        <View style={{ marginTop: space.lg }}>
          <T style={t.body} color={s.ink}>
            {e.body}
          </T>
        </View>
      ) : null}

      {seen.length > 0 ? (
        <Section title="Dónde lo has visto" s={s}>
          {seen.map((a) => (
            <Tap key={a.unit_id} onPress={() => router.push(`/unit/${a.unit_id}`)}>
              <View style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.md }}>
                <T style={[t.numeral, { width: 42 }]} color={s.muted}>
                  {a.label}
                </T>
                <View style={{ flex: 1 }}>
                  <T style={t.bodySmall} color={s.ink}>
                    {a.note ?? a.title ?? '—'}
                  </T>
                  {a.role === 'introduced' ? (
                    <T style={[t.label, { marginTop: 2 }]} color={s.accent}>
                      primera aparición
                    </T>
                  ) : null}
                </View>
              </View>
              <Rule s={s} />
            </Tap>
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
