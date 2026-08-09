/**
 * 認証 (Auth) GUI 連携 (要件 #1 §3.1.5)
 * OpenCode の Auth Login をラップし、プロバイダー一覧・ログイン実行・状態表示を提供。
 */
import type { Hono } from 'hono';
import { callOpencode, getOpencodeClient } from '../opencode.js';

export function registerAuthRoutes(app: Hono): void {
  const api = getOpencodeClient();

  // プロバイダー一覧 + 認証方法 (ログイン状態の識別表示)
  app.get('/api/auth/providers', async (c) => {
    const [providers, auth] = await Promise.all([
      callOpencode(() => api.provider.list()),
      callOpencode(() => api.provider.auth()),
    ]);
    if (providers.error || auth.error) {
      const unreachable = providers.unreachable || auth.unreachable;
      return c.json({ error: providers.error ?? auth.error }, unreachable ? 503 : 500);
    }
    return c.json({
      providers: providers.data,
      authMethods: auth.data,
    });
  });

  // ログイン実行 (OAuth authorize) — ブラウザフローをトリガー
  app.post('/api/auth/login', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.provider !== 'string') return c.json({ error: 'provider is required' }, 400);
    const method = typeof body.method === 'number' ? body.method : 0;
    const { data, error, unreachable } = await callOpencode(() =>
      api.provider.oauth.authorize({
        path: { id: body.provider },
        body: { method },
      }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });
}
