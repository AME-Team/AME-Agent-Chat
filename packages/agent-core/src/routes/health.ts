/**
 * ヘルスチェック・メタ情報 (要件 #1 §2.6)
 */
import type { Hono } from 'hono';
import { APP_INFO, env } from '../env.js';
import { pingOpencode } from '../opencode.js';

export function registerHealthRoutes(app: Hono): void {
  app.get('/health', async (c) => {
    const opencode = await pingOpencode();
    return c.json({
      status: opencode ? 'ok' : 'degraded',
      name: APP_INFO.name,
      opencodeBaseUrl: env.opencodeBaseUrl,
      opencode: opencode ? 'reachable' : 'unreachable',
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/meta', (c) =>
    c.json({
      name: APP_INFO.name,
      version: APP_INFO.version,
      ports: { frontend: 51730, agentCore: env.port, opencode: 40960, gatekeeper: 58780 },
    }),
  );
}
