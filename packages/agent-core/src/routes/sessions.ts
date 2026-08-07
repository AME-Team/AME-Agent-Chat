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
import { getOpencodeClient } from '../opencode.js';

export function registerSessionRoutes(app: Hono): void {
  const api = getOpencodeClient();

  app.get('/api/sessions', async (c) => {
    const { data, error } = await api.session.list();
    if (error) return c.json({ error }, 500);
    return c.json(data);
  });

  app.post('/api/sessions', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const { data, error } = await api.session.create({
      body: { title: typeof body.title === 'string' ? body.title : undefined },
    });
    if (error) return c.json({ error }, 500);
    return c.json(data, 201);
  });

  app.get('/api/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const { data, error } = await api.session.get({ path: { id } });
    if (error) return c.json({ error }, 404);
    return c.json(data);
  });

  app.patch('/api/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { data, error } = await api.session.update({
      path: { id },
      body: { title: typeof body.title === 'string' ? body.title : undefined },
    });
    if (error) return c.json({ error }, 500);
    return c.json(data);
  });

  app.delete('/api/sessions/:id', async (c) => {
    const id = c.req.param('id');
    const { error } = await api.session.delete({ path: { id } });
    if (error) return c.json({ error }, 500);
    return c.json({ ok: true });
  });

  // セッション複製 (#2 §2.1): 指定 messageID 地点でフォーク(メッセージコピー)。未指定は空複製
  app.post('/api/sessions/:id/fork', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { data, error } = await api.session.fork({
      path: { id },
      body: { messageID: typeof body.messageID === 'string' ? body.messageID : undefined },
    });
    if (error) return c.json({ error }, 500);
    return c.json(data, 201);
  });
}
