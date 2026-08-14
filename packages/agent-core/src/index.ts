/**
 * Agent Core (BFF) エントリポイント (要件 #1 §2.1, §2.6)
 *
 * Hono サーバをポート 30010 で起動し、OpenCode Server (40960) への中継を行う。
 */
import { serve } from '@hono/node-server';
import { createApp } from './server.js';
import { env } from './env.js';
import { log } from './logger.js';
import { pingOpencode } from './opencode.js';
import { initCurrentDirectory } from './cwd.js';

const app = createApp();

serve({ fetch: app.fetch, port: env.port, hostname: env.host }, async (info) => {
  await initCurrentDirectory();
  const opencode = await pingOpencode();
  log.info(`listening on http://${env.host}:${info.port} (log level: ${env.logLevel})`);
  log.info(`log file: ${env.logFile}`);
  log.info(
    `OpenCode Server (${env.opencodeBaseUrl}): ${opencode ? 'reachable' : 'unreachable — \`opencode serve\` を起動してください'}`,
  );
});
