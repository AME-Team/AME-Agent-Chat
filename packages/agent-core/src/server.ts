/**
 * Hono アプリ構成 (要件 #1 §2.1)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { env } from './env.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerMessageRoutes } from './routes/messages.js';
import { registerEventRoutes } from './routes/events.js';
import { registerModelRoutes } from './routes/models.js';
import { registerPermissionRoutes } from './routes/permissions.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerGitRoutes } from './routes/git.js';
import { registerAuthRoutes } from './routes/auth.js';

export function createApp(): Hono {
  const app = new Hono();

  app.use('*', logger());
  app.use(
    '/api/*',
    cors({
      origin: env.corsOrigin,
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  registerHealthRoutes(app);
  registerSessionRoutes(app);
  registerMessageRoutes(app);
  registerEventRoutes(app);
  registerModelRoutes(app);
  registerPermissionRoutes(app);
  registerSettingsRoutes(app);
  registerGitRoutes(app);
  registerAuthRoutes(app);

  app.notFound((c) => c.json({ error: 'Not Found' }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'Internal Server Error', message: String(err) }, 500);
  });

  return app;
}
