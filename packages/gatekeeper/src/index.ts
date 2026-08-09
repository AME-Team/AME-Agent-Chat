/**
 * Gatekeeper API エントリポイント (要件 #1 §2.1, §2.6, §5)
 * Windows ホスト上の別プロセス。SQLite 永続化 API を提供。
 *
 * ※ 要件 #1 §2.6 の「87880」は TCP 有効範囲(0-65535)超過のため無効。
 *   実運用可能な 5 桁ポート 58780 で起動する (要件側の誤記として PR で明示)。
 */
import { serve } from '@hono/node-server';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { createApp } from './server.js';
import { createDb, DB_PATH } from './db/index.js';

const port = Number(process.env.PORT ?? 58780);
const host = process.env.HOST ?? '0.0.0.0';

const db = createDb();
// 起動時に未適用マイグレーションを自動適用する (新規環境では data/ame.db が存在しないため必須)
migrate(db, { migrationsFolder: 'drizzle' });
console.log('[gatekeeper] migrations up to date');

const app = createApp(db);

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  console.log(`[gatekeeper] listening on http://${host}:${info.port}`);
  console.log(`[gatekeeper] sqlite: ${DB_PATH}`);
});
