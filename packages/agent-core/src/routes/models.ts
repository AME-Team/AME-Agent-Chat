/**
 * モデル・プロバイダー API (要件 #2 §6 /models, #1 §3.1.5 認証)
 *
 *  - GET /api/providers   プロバイダー一覧
 *  - GET /api/models      モデル一覧 (provider クエリで絞り込み)
 *  - GET /api/commands    コマンド一覧 (スラッシュコマンド候補)
 */
import type { Hono } from 'hono';
import { callOpencode, getOpencodeClient } from '../opencode.js';
import { SLASH_COMMANDS } from '@ame-agent-chat/shared';

export function registerModelRoutes(app: Hono): void {
  const api = getOpencodeClient();

  app.get('/api/providers', async (c) => {
    const { data, error, unreachable } = await callOpencode(() => api.provider.list());
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  app.get('/api/models', async (c) => {
    const { data, error, unreachable } = await callOpencode(() => api.config.providers());
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  app.get('/api/commands', (c) => c.json(SLASH_COMMANDS));
}
