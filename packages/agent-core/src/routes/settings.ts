/**
 * 設定プロキシ (要件 #1 §3.2.1/§3.2.3, #2 §9.3)
 * Frontend は Agent Core 単一オリジンから Gatekeeper の app_settings を読み書きする。
 */
import type { Hono } from 'hono';
import { env } from '../env.js';
import { invalidateSettingsCache } from '../router.js';

export function registerSettingsRoutes(app: Hono): void {
  app.get('/api/settings', async (c) => {
    const res = await fetch(`${env.gatekeeperUrl}/api/settings`).catch(() => null);
    if (!res) return c.json({ error: 'gatekeeper unavailable' }, 503);
    return c.json(await res.json(), res.status as 200 | 400 | 500);
  });

  app.put('/api/settings', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const res = await fetch(`${env.gatekeeperUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res) return c.json({ error: 'gatekeeper unavailable' }, 503);
    // 設定変更を BFF のルーターキャッシュへ即時反映 (書き込み成功後 — Issue #62)
    invalidateSettingsCache();
    // Gatekeeper のステータスを透過 (エラー時は失敗として伝わる)
    return c.json(await res.json(), res.status as 200 | 400 | 500);
  });

  // トークン使用量 (要件 #1 §3.2.5 / #27) — Gatekeeper から集計を取得
  app.get('/api/usage', async (c) => {
    const res = await fetch(`${env.gatekeeperUrl}/api/usage`).catch(() => null);
    if (!res) return c.json({ error: 'gatekeeper unavailable' }, 503);
    if (!res.ok) return c.json({ error: 'gatekeeper usage failed' }, 502);
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) return c.json([]);
    return c.json(data);
  });
}
