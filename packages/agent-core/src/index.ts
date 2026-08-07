/**
 * Agent Core (BFF) エントリポイント (要件 #1 §2.1, §2.6)
 *
 * Hono サーバをポート 30010 で起動し、OpenCode Server (40960) への中継を行う。
 */
import { serve } from '@hono/node-server';
import { createApp } from './server.js';
import { env } from './env.js';
import { pingOpencode } from './opencode.js';

const app = createApp();

serve({ fetch: app.fetch, port: env.port, hostname: env.host }, async (info) => {
  const opencode = await pingOpencode();
  console.log(`[agent-core] listening on http://${env.host}:${info.port}`);
  console.log(
    `[agent-core] OpenCode Server (${env.opencodeBaseUrl}): ${opencode ? 'reachable' : 'unreachable — `opencode serve` を起動してください'}`,
  );
});
