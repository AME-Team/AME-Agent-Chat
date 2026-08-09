/**
 * Gatekeeper API エントリポイント (要件 #1 §2.1, §2.6, §5)
 * ホスト OS 上の別プロセス。SQLite 永続化 API を提供。
 *
 * ※ 要件 #1 §2.6 の「87880」は TCP 有効範囲(0-65535)超過のため無効。
 *   実運用可能な 5 桁ポート 58780 で起動する (要件側の誤記として PR で明示)。
 */
import { serve } from '@hono/node-server';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { fileURLToPath } from 'node:url';
import { createApp } from './server.js';
import { createDb, migrateLegacyDb, type Db, DB_PATH } from './db/index.js';

const port = Number(process.env.PORT ?? 58780);
const host = process.env.HOST ?? '0.0.0.0';

/** 適用済みマイグレーション数 (migrate 実行前後で差分を取る) */
function appliedMigrationCount(db: Db): number {
  try {
    const row = db.get<{ c: number }>('SELECT COUNT(*) AS c FROM __drizzle_migrations');
    return row ? Number(row.c) : 0;
  } catch {
    return 0;
  }
}

async function main(): Promise<void> {
  // 旧 CWD 基準 DB の引き継ぎが失敗した場合は exitCode=1 で終了する
  if (!(await migrateLegacyDb())) {
    process.exitCode = 1;
    return;
  }
  const db = createDb();
  // 起動時に未適用マイグレーションを自動適用する (新規環境では data/ame.db が存在しないため必須)
  // CWD 非依存の絶対パスで解決する (ビルド済みファイルからの起動等に備える)
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  const before = appliedMigrationCount(db);
  try {
    migrate(db, { migrationsFolder });
  } catch (err) {
    // stderr がパイプの環境でもログが確実にフラッシュされるよう process.exit ではなく exitCode で終了する
    console.error(`[gatekeeper] migration failed. DB=${DB_PATH} folder=${migrationsFolder}`);
    console.error(err);
    // better-sqlite3 はオープン中にイベントループを生かし続けるため、明示的にクローズしてから終了する
    db.$client.close();
    process.exitCode = 1;
    return;
  }
  const applied = appliedMigrationCount(db) - before;
  if (applied > 0) {
    console.log(`[gatekeeper] applied ${applied} migration(s)`);
  } else {
    console.log('[gatekeeper] migrations up to date');
  }

  const app = createApp(db);

  const server = serve({ fetch: app.fetch, port, hostname: host }, (info) => {
    console.log(`[gatekeeper] listening on http://${host}:${info.port}`);
    console.log(`[gatekeeper] sqlite: ${DB_PATH}`);
  });

  const shutdown = (): void => {
    server.close(() => {
      db.$client.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
