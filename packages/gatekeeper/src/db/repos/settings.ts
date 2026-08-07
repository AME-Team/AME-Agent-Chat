/**
 * アプリ設定リポジトリ (要件 #1 §5 app_settings)
 * key-value の JSON 永続化 (ティア設定・Effort・配色・言語 等)。
 */
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { appSettings } from '../schema.js';
import type * as schema from '../schema.js';

type Db = BetterSQLite3Database<typeof schema>;

export function createSettingsRepo(db: Db) {
  return {
    async get(key: string): Promise<string | undefined> {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
      return row?.value;
    },

    async getAll(): Promise<Record<string, string>> {
      const rows = await db.select().from(appSettings);
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    },

    async set(key: string, value: string): Promise<void> {
      await db
        .insert(appSettings)
        .values({ key, value })
        .onConflictDoUpdate({ target: appSettings.key, set: { value } });
    },
  };
}
