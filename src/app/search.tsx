import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import * as repo from '../db/repo';
import { fonts, space } from '../design/tokens';
import { useApp } from '../state/app';
import { Rule, Screen, T, Tap, useType } from '../ui/kit';

export default function Search() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useType();
  const { chrome: s, reveal } = useApp();

  const [q, setQ] = useState('');
  const [hits, setHits] = useState<repo.Hit[]>([]);

  useEffect(() => {
    let alive = true;
    const id = setTimeout(async () => {
      const r = await repo.search(db, q, reveal);
      if (alive) setHits(r);
    }, 140);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [db, q, reveal.key, reveal.unlocked]);

  return (
    <Screen s={s}>
      <Tap onPress={() => router.back()}>
        <T style={t.meta} color={s.muted}>
          ‹ volver
        </T>
      </Tap>

      <TextInput
        value={q}
        onChangeText={setQ}
        autoFocus
        placeholder="Buscar en lo que ya leíste"
        placeholderTextColor={s.muted}
        style={{
          marginTop: space.lg,
          paddingVertical: space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: s.rule,
          color: s.ink,
          fontFamily: fonts.serif,
          fontSize: 20,
        }}
      />

      <T style={[t.caption, { marginTop: space.sm }]} color={s.muted}>
        Sólo aparece lo revelado hasta donde vas.
      </T>

      <View style={{ marginTop: space.lg }}>
        {hits.map((h) => (
          <Tap
            key={`${h.ref_kind}:${h.ref}`}
            onPress={() =>
              router.push(h.ref_kind === 'entity' ? `/entity/${h.ref}` : `/unit/${h.ref}`)
            }
          >
            <View style={{ paddingVertical: space.md }}>
              <T style={t.label} color={s.muted}>
                {h.ref_kind === 'entity' ? 'del mundo' : 'capítulo'}
              </T>
              <T style={[t.subtitle, { marginTop: 2 }]} color={s.ink}>
                {h.title}
              </T>
              {h.snippet ? (
                <T style={t.caption} color={s.muted} numberOfLines={2}>
                  {h.snippet}
                </T>
              ) : null}
            </View>
            <Rule s={s} />
          </Tap>
        ))}
        {q.length >= 2 && hits.length === 0 ? (
          <T style={t.bodySmall} color={s.muted}>
            Nada por aquí.
          </T>
        ) : null}
      </View>
    </Screen>
  );
}
