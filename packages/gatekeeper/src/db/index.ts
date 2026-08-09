/**
 * Drizzle + better-sqlite3 クライアント (要件 #1 §5)
 * データベースは Gatekeeper パッケージ配下 data/ame.db に配置(ホスト側永続化)。
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

// CWD 非依存でパッケージルートの data/ame.db を指す (マイグレーションフォルダと解決基準を統一)
const DEFAULT_DB_PATH = fileURLToPath(new URL('../../data/ame.db', import.meta.url));

// 旧バージョンは CWD 基準の data/ame.db を既定値としており、別 CWD から起動していた環境では
// 既存データが参照されなくなるため、新パスに DB が無く旧 CWD に DB がある場合のみ引き継ぐ。
const LEGACY_DB_PATH = resolve('data/ame.db');
if (
  LEGACY_DB_PATH !== DEFAULT_DB_PATH &&
  existsSync(LEGACY_DB_PATH) &&
  !existsSync(DEFAULT_DB_PATH)
) {
  mkdirSync(dirname(DEFAULT_DB_PATH), { recursive: true });
  copyFileSync(LEGACY_DB_PATH, DEFAULT_DB_PATH);
  console.warn(`[gatekeeper] legacy DB migrated: ${LEGACY_DB_PATH} -> ${DEFAULT_DB_PATH}`);
}

export const DB_PATH = process.env.AME_DB_PATH ?? DEFAULT_DB_PATH;

export function createDb(): BetterSQLite3Database<typeof schema> {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}
