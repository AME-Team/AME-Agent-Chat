/**
 * 設定プロキシ (要件 #1 §3.2.1/§3.2.3, #2 §9.3)
 * Frontend は Agent Core 単一オリジンから Gatekeeper の app_settings を読み書きする。
 */
import type { Hono } from 'hono';
import { env } from '../env.js';

export function registerSettingsRoutes(app: Hono): void {
  app.get('/api/settings', async (c) => {
    const res = await fetch(`${env.gatekeeperUrl}/api/settings`).catch(() => null);
    if (!res) return c.json({ error: 'gatekeeper unavailable' }, 503);
    return c.json(await res.json());
  });

  app.put('/api/settings', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const res = await fetch(`${env.gatekeeperUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res) return c.json({ error: 'gatekeeper unavailable' }, 503);
    return c.json(await res.json());
  });
}
