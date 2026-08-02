import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { canvasFromPack, chromeFor, Surface } from '../design/theme';
import * as repo from '../db/repo';

type Current = Awaited<ReturnType<typeof repo.getCurrent>>;

type Ctx = {
  ready: boolean;
  current: Current;
  /** superficie del chrome — sigue al sistema */
  chrome: Surface;
  /** superficie del canvas — tono del pack, independiente del sistema */
  canvas: Surface;
  reveal: repo.Reveal;
  unlocked: boolean;
  setUnlocked: (v: boolean) => void;
  refresh: () => Promise<void>;
  advance: (unitId: string) => Promise<void>;
  packBase: string;
  setPackBase: (v: string) => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);

export const DEFAULT_PACK_BASE = 'http://192.168.1.112:8788';

export function AppProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const scheme = useColorScheme();

  const [ready, setReady] = useState(false);
  const [current, setCurrent] = useState<Current>(null);
  const [unlocked, setUnlockedState] = useState(false);
  const [packBase, setPackBaseState] = useState(DEFAULT_PACK_BASE);

  const refresh = useCallback(async () => {
    const [cur, unl, base] = await Promise.all([
      repo.getCurrent(db),
      repo.getSetting(db, 'unlocked'),
      repo.getSetting(db, 'pack_base'),
    ]);
    setCurrent(cur);
    setUnlockedState(unl === '1');
    if (base) setPackBaseState(base);
    setReady(true);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setUnlocked = useCallback(
    (v: boolean) => {
      setUnlockedState(v);
      repo.setSetting(db, 'unlocked', v ? '1' : '0');
    },
    [db]
  );

  const setPackBase = useCallback(
    async (v: string) => {
      setPackBaseState(v);
      await repo.setSetting(db, 'pack_base', v);
    },
    [db]
  );

  const advance = useCallback(
    async (unitId: string) => {
      if (!current) return;
      await repo.setProgress(db, current.book.id, unitId);
      await refresh();
    },
    [db, current, refresh]
  );

  const value = useMemo<Ctx>(() => {
    let theme = null;
    try {
      theme = current?.book.theme ? JSON.parse(current.book.theme) : null;
    } catch {
      theme = null;
    }
    return {
      ready,
      current,
      chrome: chromeFor(scheme),
      canvas: canvasFromPack(theme),
      reveal: repo.reveal(current?.reveal ?? 0, unlocked),
      unlocked,
      setUnlocked,
      refresh,
      advance,
      packBase,
      setPackBase,
    };
  }, [ready, current, scheme, unlocked, setUnlocked, refresh, advance, packBase, setPackBase]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp fuera de AppProvider');
  return ctx;
}
