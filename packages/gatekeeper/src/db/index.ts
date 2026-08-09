/**
 * Drizzle + better-sqlite3 クライアント (要件 #1 §5)
 * データベースは Gatekeeper パッケージ配下 data/ame.db に配置(ホスト側永続化)。
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

// CWD 非依存でパッケージルートの data/ame.db を指す (マイグレーションフォルダと解決基準を統一)
export const DB_PATH =
  process.env.AME_DB_PATH ?? fileURLToPath(new URL('../../data/ame.db', import.meta.url));

export function createDb(): BetterSQLite3Database<typeof schema> {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}
