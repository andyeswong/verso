import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as client from '../assistant/client';
import { fonts, space } from '../design/tokens';
import { useApp } from '../state/app';
import { Rule, Screen, T, Tap, useType } from '../ui/kit';

type Turn = { role: 'user' | 'assistant'; body: string; at: string };

export default function Assistant() {
  const router = useRouter();
  const t = useType();
  const { chrome: s, current } = useApp();

  const [cfg, setCfg] = useState<client.Config | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    client.loadConfig().then(setCfg);
  }, []);

  if (!current) {
    return (
      <Screen s={s}>
        <View />
      </Screen>
    );
  }

  if (!cfg) {
    return (
      <Screen s={s}>
        <Tap onPress={() => router.back()}>
          <T style={t.meta} color={s.muted}>
            ‹ volver
          </T>
        </Tap>
        <View style={{ marginTop: space.xxl }}>
          <T style={t.title} color={s.ink}>
            Sin proveedor configurado.
          </T>
          <T style={[t.body, { marginTop: space.md }]} color={s.muted}>
            El asistente usa tu propia clave. Configúrala en ajustes.
          </T>
          <Tap onPress={() => router.replace('/settings')} style={{ marginTop: space.lg }}>
            <T style={t.meta} color={s.accent}>
              Ir a ajustes →
            </T>
          </Tap>
        </View>
      </Screen>
    );
  }

  const send = async () => {
    const text = q.trim();
    if (!text || busy) return;
    const at = current.unit.label;
    setQ('');
    setTurns((prev) => [...prev, { role: 'user', body: text, at }]);
    setBusy(true);
    try {
      const history: client.Msg[] = [
        {
          role: 'system',
          content: client.systemPrompt(current.book.title, current.unit.label, current.unit.title),
        },
        ...turns.map((x) => ({ role: x.role, content: x.body }) as client.Msg),
        { role: 'user', content: text },
      ];
      const answer = await client.ask(cfg, history);
      setTurns((prev) => [...prev, { role: 'assistant', body: answer, at }]);
    } catch (e: any) {
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', body: `No se pudo preguntar: ${e?.message ?? e}`, at },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: s.paper }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        s={s}
        scroll={false}
        footer={
          <View style={{ flexDirection: 'row', gap: space.sm, paddingVertical: space.md }}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder={`Preguntar · vas por ${current.unit.label}`}
              placeholderTextColor={s.muted}
              onSubmitEditing={send}
              style={{
                flex: 1,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: s.rule,
                paddingHorizontal: space.md,
                paddingVertical: space.md,
                color: s.ink,
                fontFamily: fonts.serif,
                fontSize: 16,
              }}
            />
            <Tap onPress={send} disabled={busy}>
              <View
                style={{
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: busy ? s.rule : s.ink,
                  paddingHorizontal: space.base,
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <T style={t.label} color={busy ? s.muted : s.ink}>
                  {busy ? '…' : 'ir'}
                </T>
              </View>
            </Tap>
          </View>
        }
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Tap onPress={() => router.back()}>
            <T style={t.meta} color={s.muted}>
              ‹ volver
            </T>
          </Tap>
          <T style={t.meta} color={s.muted}>
            {cfg.model}
          </T>
        </View>

        <ScrollView ref={scroller} style={{ marginTop: space.base }} showsVerticalScrollIndicator={false}>
          <View style={{ backgroundColor: s.sealed, padding: space.md, marginBottom: space.lg }}>
            <T style={t.caption} color={s.muted}>
              Consultor secundario. Sabe por dónde vas y se le pide que no se adelante, pero el
              modelo conoce el libro entero: lo que responda no está verificado y puede
              equivocarse o filtrar algo. El material curado del pack sí lo está.
            </T>
          </View>

          {turns.map((turn, i) => (
            <View key={i} style={{ marginBottom: space.lg }}>
              <T style={t.label} color={turn.role === 'user' ? s.ink : s.accent}>
                {turn.role === 'user' ? 'tú' : `respuesta · ${turn.at}`}
              </T>
              <T style={[t.body, { marginTop: space.xs }]} color={turn.role === 'user' ? s.ink : s.ink}>
                {turn.body}
              </T>
              {turn.role === 'assistant' ? <Rule s={s} style={{ marginTop: space.md }} /> : null}
            </View>
          ))}
        </ScrollView>
      </Screen>
    </KeyboardAvoidingView>
  );
}
