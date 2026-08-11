/**
 * Hono アプリ構成 (要件 #1 §2.1)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { log } from './logger.js';
import { ensureCurrentDirectoryLoaded } from './cwd.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerEventRoutes } from './routes/events.js';
import { registerModelRoutes } from './routes/models.js';
import { registerPermissionRoutes } from './routes/permissions.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerGitRoutes } from './routes/git.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerCwdRoutes } from './routes/cwd.js';

export function createApp(): Hono {
  const app = new Hono();

  // リクエストログはレベル毎に排他 (#55)
  // - info: Hono 組込アクセスロガー
  // - debug: 自作の詳細ログ (method/path/status/ms) に置き換え
  // - warn/error: 静穏化
  if (env.logLevel === 'info') {
    app.use('*', logger());
  }
  if (env.logLevel === 'debug') {
    app.use('*', async (c, next) => {
      const start = performance.now();
      await next();
      const ms = Math.round((performance.now() - start) * 100) / 100;
      log.debug(`${c.req.method} ${c.req.path} -> ${c.res.status} (${ms}ms)`);
    });
  }
  app.use(
    '/api/*',
    cors({
      origin: env.corsOrigin,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  // 永続化済みカレントディレクトリの復元を再試行 (#56)
  // withDirectory() は同期のため、リクエスト毎にここで復元を保証する
  app.use('/api/*', async (_c, next) => {
    await ensureCurrentDirectoryLoaded();
    await next();
  });

  registerHealthRoutes(app);
  registerSessionRoutes(app);
  registerMessageRoutes(app);
  registerEventRoutes(app);
  registerModelRoutes(app);
  registerPermissionRoutes(app);
  registerSettingsRoutes(app);
  registerGitRoutes(app);
  registerAuthRoutes(app);
  registerCwdRoutes(app);

  app.notFound((c) => c.json({ error: 'Not Found' }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal Server Error', message: String(err) }, 500);
  });

  return app;
}
