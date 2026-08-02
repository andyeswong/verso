import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as repo from '../../db/repo';
import { useLayout } from '../../design/layout';
import { Surface } from '../../design/theme';
import { space } from '../../design/tokens';
import { useApp } from '../../state/app';
import { Hero, Rule, Screen, SealMark, Section, T, Tap, useType } from '../../ui/kit';
import { kindLabel } from '../index';

export default function UnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useType();
  const { content } = useLayout();
  // Canvas: tono del pack, no del sistema. La oscuridad es contenido, no tema.
  const { canvas: s, reveal, current, advance } = useApp();

  const [unit, setUnit] = useState<repo.Unit | null>(null);
  const [sealed, setSealed] = useState(false);
  const [cards, setCards] = useState<repo.Card[]>([]);
  const [appearing, setAppearing] = useState<{ visible: repo.Appearing[]; hidden: number }>({
    visible: [],
    hidden: 0,
  });
  const [nav, setNav] = useState<{ prev: repo.Unit | null; next: repo.Unit | null }>({
    prev: null,
    next: null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const got = await repo.getUnit(db, id, reveal);
      if (!got || !alive) return;
      setUnit(got.unit);
      setSealed(got.sealed);
      const [cs, ap, nb] = await Promise.all([
        repo.listCards(db, id, reveal),
        repo.listAppearing(db, id, reveal),
        repo.neighbours(db, got.unit),
      ]);
      if (!alive) return;
      setCards(cs);
      setAppearing(ap);
      setNav(nb);
    })();
    return () => {
      alive = false;
    };
  }, [db, id, reveal.key, reveal.unlocked]);

  if (!unit) {
    return (
      <Screen s={s}>
        <View />
      </Screen>
    );
  }

  if (sealed) return <Sealed s={s} unit={unit} onBack={() => router.back()} />;

  const heroCard = cards.find((c) => c.slot === 'hero' && c.asset);
  const bodyCards = cards.filter((c) => c !== heroCard);
  const isCurrent = current?.unit.id === unit.id;

  return (
    <Screen
      s={s}
      footer={
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: space.md,
          }}
        >
          <Tap
            onPress={() => nav.prev && router.replace(`/unit/${nav.prev.id}`)}
            disabled={!nav.prev}
          >
            <T style={t.meta} color={nav.prev ? s.muted : s.rule}>
              ‹ {nav.prev?.label ?? ''}
            </T>
          </Tap>

          <Tap
            onPress={async () => {
              if (nav.next) {
                await advance(nav.next.id);
                router.replace(`/unit/${nav.next.id}`);
              }
            }}
            disabled={!nav.next || !isCurrent}
          >
            <View
              style={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: isCurrent && nav.next ? s.accent : s.rule,
                paddingVertical: space.sm,
                paddingHorizontal: space.base,
              }}
            >
              <T style={t.label} color={isCurrent && nav.next ? s.accent : s.rule}>
                Leído
              </T>
            </View>
          </Tap>

          <Tap
            onPress={() => nav.next && router.replace(`/unit/${nav.next.id}`)}
            disabled={!nav.next || nav.next.reveal_key > (reveal.unlocked ? Infinity : reveal.key)}
          >
            <T style={t.meta} color={s.muted}>
              {nav.next?.label ?? ''} ›
            </T>
          </Tap>
        </View>
      }
    >
      {/* barra */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Tap onPress={() => router.back()}>
          <T style={t.meta} color={s.muted}>
            ‹ volver
          </T>
        </Tap>
        <Tap onPress={() => router.push('/assistant')}>
          <T style={t.meta} color={s.muted}>
            preguntar
          </T>
        </Tap>
      </View>

      {/* cabecera: la anatomía de la cabecera de capítulo del libro */}
      <View style={{ marginTop: space.xl }}>
        <T style={t.display} color={s.ink}>
          {unit.label}
        </T>
        <Rule s={s} style={{ marginTop: space.sm, marginBottom: space.md }} />
        <T style={[t.label, { letterSpacing: 2 }]} color={s.muted}>
          {unit.title ?? kindLabel(unit.kind)}
        </T>
      </View>

      {unit.epigraph ? (
        <View
          style={{
            marginTop: space.lg,
            backgroundColor: s.elevated,
            padding: space.base,
            borderLeftWidth: 2,
            borderLeftColor: s.accent,
          }}
        >
          <T style={t.quote} color={s.ink}>
            {unit.epigraph}
          </T>
          {unit.epigraph_src ? (
            <T style={[t.caption, { marginTop: space.sm }]} color={s.muted}>
              {unit.epigraph_src}
            </T>
          ) : null}
        </View>
      ) : null}

      {heroCard?.asset ? (
        <View style={{ marginTop: space.lg }}>
          <Hero
            uri={heroCard.asset.uri}
            tint={heroCard.asset.blurhash}
            width={content}
            s={s}
            caption={heroCard.title ?? heroCard.asset.caption}
          />
        </View>
      ) : null}

      {bodyCards.map((c) => (
        <CardView key={c.id} c={c} s={s} width={content} />
      ))}

      {appearing.visible.length > 0 || appearing.hidden > 0 ? (
        <Section title="Aparecen" s={s}>
          {appearing.visible.map((a) => (
            <Tap key={a.entity_id} onPress={() => router.push(`/entity/${a.entity_id}`)}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  paddingVertical: space.md,
                }}
              >
                <View style={{ width: 44, height: 44, backgroundColor: a.blurhash ?? s.sealed }}>
                  {a.asset_uri ? (
                    <Image
                      source={{ uri: a.asset_uri }}
                      style={{ width: 44, height: 44 }}
                      contentFit="cover"
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
                    <T style={t.subtitle} color={s.ink}>
                      {a.name}
                    </T>
                    {a.role === 'introduced' ? (
                      <T style={t.label} color={s.accent}>
                        nuevo
                      </T>
                    ) : null}
                  </View>
                  {a.note || a.summary ? (
                    <T style={t.caption} color={s.muted} numberOfLines={2}>
                      {a.note ?? a.summary}
                    </T>
                  ) : null}
                </View>
              </View>
              <Rule s={s} />
            </Tap>
          ))}

          {appearing.hidden > 0 ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                paddingVertical: space.md,
              }}
            >
              <SealMark s={s} />
              <T style={t.meta} color={s.muted}>
                {appearing.hidden} más aún sin revelar
              </T>
            </View>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}

function CardView({ c, s, width }: { c: repo.Card; s: Surface; width: number }) {
  const t = useType();
  const router = useRouter();

  if (c.kind === 'note') {
    return (
      <View style={{ marginTop: space.lg }}>
        {c.title ? (
          <T style={[t.subtitle, { marginBottom: space.sm }]} color={s.ink}>
            {c.title}
          </T>
        ) : null}
        <T style={t.body} color={s.ink}>
          {c.body}
        </T>
      </View>
    );
  }

  if (c.kind === 'quote') {
    return (
      <View style={{ marginTop: space.lg, paddingLeft: space.base, borderLeftWidth: 2, borderLeftColor: s.rule }}>
        <T style={t.quote} color={s.ink}>
          {c.body}
        </T>
        {c.title ? (
          <T style={[t.caption, { marginTop: space.sm }]} color={s.muted}>
            {c.title}
          </T>
        ) : null}
      </View>
    );
  }

  if ((c.kind === 'scene' || c.kind === 'media' || c.kind === 'map') && c.asset) {
    return (
      <View style={{ marginTop: space.lg }}>
        <Hero
          uri={c.asset.uri}
          tint={c.asset.blurhash}
          width={width}
          s={s}
          caption={c.title ?? c.asset.caption}
        />
      </View>
    );
  }

  if (c.kind === 'entity_ref' && c.ref_entity) {
    return (
      <Tap onPress={() => router.push(`/entity/${c.ref_entity}`)} style={{ marginTop: space.lg }}>
        <View style={{ backgroundColor: s.elevated, padding: space.base }}>
          <T style={t.label} color={s.muted}>
            {c.title ?? 'del mundo'}
          </T>
          <T style={[t.subtitle, { marginTop: space.xs }]} color={s.ink}>
            {c.ref_name}
          </T>
          {c.ref_summary ? (
            <T style={[t.caption, { marginTop: space.xs }]} color={s.muted}>
              {c.ref_summary}
            </T>
          ) : null}
        </View>
      </Tap>
    );
  }

  return null;
}

function Sealed({ s, unit, onBack }: { s: Surface; unit: repo.Unit; onBack: () => void }) {
  const t = useType();
  return (
    <Screen s={s}>
      <Tap onPress={onBack}>
        <T style={t.meta} color={s.muted}>
          ‹ volver
        </T>
      </Tap>
      <View style={{ marginTop: space.xxxl, alignItems: 'flex-start' }}>
        <T style={t.display} color={s.muted}>
          {unit.label}
        </T>
        <Rule s={s} style={{ marginTop: space.sm, marginBottom: space.lg, alignSelf: 'stretch' }} />
        <T style={t.body} color={s.muted}>
          Todavía no llegas aquí. Cuando marques este capítulo como leído, Verso te abre lo que
          contiene.
        </T>
      </View>
    </Screen>
  );
}
