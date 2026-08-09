/**
 * Drizzle + better-sqlite3 クライアント (要件 #1 §5)
 * データベースは Gatekeeper パッケージ配下 data/ame.db に配置(ホスト側永続化)。
 */
import Database from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema.js';

// CWD 非依存でパッケージルートの data/ame.db を指す (マイグレーションフォルダと解決基準を統一)
const DEFAULT_DB_PATH = fileURLToPath(new URL('../../data/ame.db', import.meta.url));

// 旧バージョンは CWD 基準の data/ame.db を既定値としており、別 CWD から起動していた環境では
// 既存データが参照されなくなる。新パスに DB が無く旧 CWD に DB がある場合のみ引き継ぐ。
// AME_DB_PATH が明示指定されている場合は env が優先されるためレガシー引き継ぎは行わない。
const LEGACY_DB_PATH = resolve('data/ame.db');

/**
 * 旧 CWD 基準の DB を better-sqlite3 の backup API で引き継ぐ。
 * WAL に保持された未チェックポイントのコミットも安全に含まれ、他プロセスが
 * オープン中でもファイルコピーより破損リスクが低い。失敗時はエラーログを出し false を返す。
 */
export async function migrateLegacyDb(): Promise<boolean> {
  if (
    process.env.AME_DB_PATH ||
    LEGACY_DB_PATH === DEFAULT_DB_PATH ||
    !existsSync(LEGACY_DB_PATH) ||
    existsSync(DEFAULT_DB_PATH)
  ) {
    return true;
  }

  mkdirSync(dirname(DEFAULT_DB_PATH), { recursive: true });
  try {
    const legacy = new Database(LEGACY_DB_PATH, { readonly: true });
    try {
      await legacy.backup(DEFAULT_DB_PATH);
    } finally {
      legacy.close();
    }
  } catch (err) {
    // 途中まで書き込まれた部分ファイルを削除し、次回起動時に再試行できるようにする
    rmSync(DEFAULT_DB_PATH, { force: true });
    console.error(
      `[gatekeeper] legacy DB migration failed: ${LEGACY_DB_PATH} -> ${DEFAULT_DB_PATH}`,
    );
    console.error(err);
    return false;
  }
  console.warn(`[gatekeeper] legacy DB migrated: ${LEGACY_DB_PATH} -> ${DEFAULT_DB_PATH}`);
  return true;
}

export const DB_PATH = process.env.AME_DB_PATH ?? DEFAULT_DB_PATH;

export type Db = BetterSQLite3Database<typeof schema> & { $client: SqliteDatabase };

export function createDb(): Db {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}
