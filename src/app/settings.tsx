import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, TextInput, View } from 'react-native';
import * as client from '../assistant/client';
import { importPack, packStorageSize } from '../pack/import';
import { httpSource, pickFolderSource } from '../pack/source';
import * as repo from '../db/repo';
import { fonts, space } from '../design/tokens';
import { Surface } from '../design/theme';
import { useApp } from '../state/app';
import { Label, Rule, Screen, Section, T, Tap, useType } from '../ui/kit';

export default function Settings() {
  const db = useSQLiteContext();
  const router = useRouter();
  const t = useType();
  const { chrome: s, unlocked, setUnlocked, packBase, setPackBase, refresh } = useApp();

  const [base, setBase] = useState(packBase);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [packs, setPacks] = useState<{ id: string; title: string; version: string; size: number }[]>([]);

  const [aBase, setABase] = useState('');
  const [aKey, setAKey] = useState('');
  const [aModel, setAModel] = useState('');
  const [aSaved, setASaved] = useState(false);

  useEffect(() => setBase(packBase), [packBase]);

  const reloadPacks = async () => {
    const rows = await db.getAllAsync<{ id: string; title: string; version: string }>(
      'SELECT id, title, version FROM pack ORDER BY installed_at DESC'
    );
    setPacks(rows.map((p) => ({ ...p, size: packStorageSize(p.id) })));
  };

  useEffect(() => {
    reloadPacks();
    client.loadConfig().then((c) => {
      if (c) {
        setABase(c.base);
        setAKey(c.key);
        setAModel(c.model);
        setASaved(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runImport = async (make: () => Promise<any> | any, first: string) => {
    setError(null);
    setBusy(first);
    try {
      const source = await make();
      const r = await importPack(db, source, (msg) => setBusy(msg));
      await refresh();
      await reloadPacks();
      setBusy(null);
      router.replace('/');
      console.log('pack importado', r);
    } catch (e: any) {
      setBusy(null);
      const msg = e?.message ?? String(e);
      // Cancelar el selector de carpetas no es un error que valga mostrar.
      if (/cancel/i.test(msg)) return;
      setError(msg);
    }
  };

  const importFromUrl = () =>
    runImport(async () => {
      await setPackBase(base);
      return httpSource(base);
    }, 'Conectando…');

  const importFromFolder = () => runImport(() => pickFolderSource(), 'Abriendo la carpeta…');

  return (
    <Screen s={s}>
      <Tap onPress={() => router.back()}>
        <T style={t.meta} color={s.muted}>
          ‹ volver
        </T>
      </Tap>

      <Section title="Packs" s={s}>
        <T style={[t.caption, { marginBottom: space.base }]} color={s.muted}>
          La media se copia dentro de Verso, así que una vez importado el pack funciona
          sin red.
        </T>

        <Label s={s}>Desde una carpeta del dispositivo</Label>
        <T style={[t.caption, { marginBottom: space.sm }]} color={s.muted}>
          La que sincroniza Syncthing, por ejemplo. Se pide permiso una vez y las
          siguientes veces ya no pregunta. Es el único camino que no necesita red.
        </T>
        <Tap onPress={importFromFolder} disabled={!!busy}>
          <View
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: busy ? s.rule : s.ink,
              paddingVertical: space.md,
              alignItems: 'center',
            }}
          >
            <T style={t.label} color={busy ? s.muted : s.ink}>
              Elegir carpeta
            </T>
          </View>
        </Tap>

        <View style={{ height: space.lg }} />

        <Label s={s}>Desde una URL</Label>
        <T style={[t.caption, { marginBottom: space.sm }]} color={s.muted}>
          Una carpeta de pack servida por HTTP.
        </T>
        <Field s={s} value={base} onChange={setBase} placeholder="http://192.168.1.10:8788" />
        <Tap onPress={importFromUrl} disabled={!!busy} style={{ marginTop: space.sm }}>
          <View
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: busy ? s.rule : s.muted,
              paddingVertical: space.md,
              alignItems: 'center',
            }}
          >
            <T style={t.label} color={busy ? s.muted : s.muted}>
              Importar desde la URL
            </T>
          </View>
        </Tap>

        {busy ? (
          <View style={{ marginTop: space.md, alignItems: 'center' }}>
            <T style={t.meta} color={s.accent}>
              {busy}
            </T>
          </View>
        ) : null}

        {error ? (
          <View style={{ marginTop: space.md, backgroundColor: s.sealed, padding: space.md }}>
            <T style={t.caption} color={s.ink}>
              {error}
            </T>
          </View>
        ) : null}

        {packs.length > 0 ? (
          <View style={{ marginTop: space.lg }}>
            {packs.map((p) => (
              <View key={p.id} style={{ paddingVertical: space.md }}>
                <T style={t.bodySmall} color={s.ink}>
                  {p.title}
                </T>
                <T style={t.meta} color={s.muted}>
                  v{p.version} · {(p.size / 1024 / 1024).toFixed(1)} MB
                </T>
                <Rule s={s} style={{ marginTop: space.md }} />
              </View>
            ))}
          </View>
        ) : null}
      </Section>

      <Section title="Spoilers" s={s}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: space.base }}>
            <T style={t.bodySmall} color={s.ink}>
              Abrir todo el libro
            </T>
            <T style={t.caption} color={s.muted}>
              Para libros que ya leíste. Quita el sello de todo lo que va por delante.
            </T>
          </View>
          <Switch
            value={unlocked}
            onValueChange={setUnlocked}
            trackColor={{ true: s.accent, false: s.rule }}
          />
        </View>
        {unlocked ? (
          <View style={{ marginTop: space.md, backgroundColor: s.sealed, padding: space.md }}>
            <T style={t.caption} color={s.ink}>
              Todo abierto. Lo que veas puede adelantarte cosas del libro.
            </T>
          </View>
        ) : null}
      </Section>

      <Section title="Asistente" s={s}>
        <T style={[t.caption, { marginBottom: space.md }]} color={s.muted}>
          Cualquier proveedor compatible con OpenAI. La clave se guarda cifrada en el
          dispositivo. Sin clave, el asistente no aparece.
        </T>
        <Label s={s}>URL base</Label>
        <Field s={s} value={aBase} onChange={setABase} placeholder="https://…/v1" />
        <View style={{ height: space.md }} />
        <Label s={s}>Clave</Label>
        <Field s={s} value={aKey} onChange={setAKey} placeholder="sk-…" secure />
        <View style={{ height: space.md }} />
        <Label s={s}>Modelo</Label>
        <Field s={s} value={aModel} onChange={setAModel} placeholder="deepseek-v4-flash" />

        <View style={{ flexDirection: 'row', gap: space.md, marginTop: space.md }}>
          <Tap
            onPress={async () => {
              await client.saveConfig({ base: aBase, key: aKey, model: aModel });
              setASaved(true);
            }}
          >
            <View
              style={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: s.ink,
                paddingVertical: space.sm,
                paddingHorizontal: space.base,
              }}
            >
              <T style={t.label} color={s.ink}>
                Guardar
              </T>
            </View>
          </Tap>
          {aSaved ? (
            <Tap
              onPress={async () => {
                await client.clearConfig();
                setABase('');
                setAKey('');
                setAModel('');
                setASaved(false);
              }}
            >
              <View style={{ paddingVertical: space.sm, paddingHorizontal: space.base }}>
                <T style={t.label} color={s.muted}>
                  Borrar
                </T>
              </View>
            </Tap>
          ) : null}
        </View>
      </Section>
    </Screen>
  );
}

function Field({
  s,
  value,
  onChange,
  placeholder,
  secure,
}: {
  s: Surface;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secure?: boolean;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={s.muted}
      autoCapitalize="none"
      autoCorrect={false}
      secureTextEntry={secure}
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: s.rule,
        backgroundColor: s.elevated,
        paddingHorizontal: space.md,
        paddingVertical: space.md,
        color: s.ink,
        fontFamily: fonts.mono,
        fontSize: 13,
      }}
    />
  );
}
