import * as SQLite from 'expo-sqlite';
import { DDL, DDL_FTS, SCHEMA_VERSION } from './schema';

export const DB_NAME = 'verso.db';

/**
 * Migración por PRAGMA user_version. En v1 sólo se crea el esquema; las versiones
 * siguientes añaden su bloque y suben el número. Nunca se recrea la base: el estado
 * del usuario tiene que sobrevivir.
 */
export async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  if (current >= SCHEMA_VERSION) {
    await db.execAsync('PRAGMA foreign_keys = ON;');
    return;
  }

  if (current < 1) {
    await db.execAsync(DDL);
    await db.execAsync(DDL_FTS);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}
