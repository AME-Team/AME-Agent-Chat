/**
 * セッション API (要件 #2 §2)
 *
 * OpenCode SDK の session API をラップ:
 *  - GET    /api/sessions        一覧
 *  - POST   /api/sessions        新規作成 (/new 相当)
 *  - GET    /api/sessions/:id    取得
 *  - PATCH  /api/sessions/:id    更新 (タイトル編集 #2 §2.2)
 *  - DELETE /api/sessions/:id    削除 (#2 §2.1)
 */
import type { Hono } from 'hono';
import { callOpencode, getOpencodeClient } from '../opencode.js';
import { env } from '../env.js';
import { withDirectory } from '../cwd.js';

export function registerSessionRoutes(app: Hono): void {
  const api = getOpencodeClient();

  app.get('/api/sessions', async (c) => {
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.list({ query: withDirectory() }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  app.post('/api/sessions', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.create({
        body: { title: typeof body.title === 'string' ? body.title : undefined },
        query: withDirectory(),
      }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data, 201);
  });

  app.get('/api/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.get({ path: { id }, query: withDirectory() }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 404);
    return c.json(data);
  });

  app.patch('/api/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.update({
        path: { id },
        body: { title: typeof body.title === 'string' ? body.title : undefined },
        query: withDirectory(),
      }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  app.delete('/api/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const { error, unreachable } = await callOpencode(() =>
      api.session.delete({ path: { id }, query: withDirectory() }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json({ ok: true });
  });

  // セッション複製 (#2 §2.1): 指定 messageID 地点でフォーク(メッセージコピー)。未指定は空複製
  app.post('/api/sessions/:id/fork', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.fork({
        path: { id },
        body: { messageID: typeof body.messageID === 'string' ? body.messageID : undefined },
        query: withDirectory(),
      }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data, 201);
  });

  // セッション共有 / 共有解除 (#2 §6 /share /unshare)
  app.post('/api/sessions/:id/share', async (c) => {
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.share({ path: { id: c.req.param('id') }, query: withDirectory() }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  app.post('/api/sessions/:id/unshare', async (c) => {
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.unshare({ path: { id: c.req.param('id') }, query: withDirectory() }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  // 全文検索 (Gatekeeper の タイトル+メッセージ内容 検索へ中継) — #2 §2.3
  // ※Gatekeeper /api/sessions の q はタイトル+メッセージ内容の LIKE 全文検索を実装済み (#6)
  app.get('/api/search', async (c) => {
    const q = c.req.query('q') ?? '';
    if (!q) return c.json([]);
    const res = await fetch(
      `${env.gatekeeperUrl}/api/sessions?q=${encodeURIComponent(q)}&sort=updated`,
    ).catch(() => null);
    if (!res) return c.json({ error: 'gatekeeper unavailable' }, 503);
    if (!res.ok)
      return c.json({ error: 'gatekeeper search failed', message: await res.json() }, 502);
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data)) return c.json({ error: 'invalid gatekeeper response' }, 502);
    return c.json(data);
  });

  // JSON インポート (要件 #2 §2.4): Gatekeeper へセッション+メッセージを復元
  app.post('/api/import', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.title !== 'string') return c.json({ error: 'title is required' }, 400);
    const messages = Array.isArray(body.messages) ? body.messages : [];
    // Gatekeeper にセッション作成 (失敗は伝播)
    const createRes = await fetch(`${env.gatekeeperUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: body.title }),
    }).catch(() => null);
    if (!createRes) return c.json({ error: 'gatekeeper unavailable' }, 503);
    if (!createRes.ok)
      return c.json({ error: 'gatekeeper create failed', message: await createRes.json() }, 502);
    const session = (await createRes.json()) as { id?: string };
    if (!session?.id) return c.json({ error: 'invalid gatekeeper response' }, 502);

    // メッセージを追加 (失敗数を記録して部分成功を可視化)
    let failed = 0;
    for (const m of messages) {
      if (m && typeof m.role === 'string' && typeof m.text === 'string') {
        const res = await fetch(`${env.gatekeeperUrl}/api/sessions/${session.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: m.role, content: m.text }),
        }).catch(() => null);
        if (!res?.ok) failed++;
      }
    }
    return c.json({ ...session, importedMessages: messages.length, failedMessages: failed }, 201);
  });
}
