/**
 * メッセージ・コマンド API (要件 #2 §3.1, §4, §5, §6)
 *
 *  - GET   /api/sessions/:id/messages        メッセージ一覧 (#2 §4)
 *  - POST  /api/sessions/:id/messages        プロンプト送信 (#2 §3.1)
 *      body.model を与えると LLM ルーター(#15)の選択結果を注入 (#1 §2.3)
 *  - POST  /api/sessions/:id/abort           生成停止 (#2 §5)
 *  - POST  /api/sessions/:id/command         スラッシュコマンド実行 (#2 §6)
 *  - POST  /api/sessions/:id/summarize       /compact (#2 §5, §6)
 *  - POST  /api/sessions/:id/init            /init (#2 §6)
 */
import type { Hono } from 'hono';
import { getOpencodeClient } from '../opencode.js';

interface PromptRequestBody {
  text: string;
  model?: { providerID: string; modelID: string };
  agent?: string;
}

export function registerMessageRoutes(app: Hono): void {
  const api = getOpencodeClient();

  app.get('/api/sessions/:id/messages', async (c) => {
    const id = c.req.param('id');
    const limit = Number(c.req.query('limit') ?? 0) || undefined;
    const { data, error } = await api.session.messages({ path: { id }, query: { limit } });
    if (error) return c.json({ error }, 500);
    return c.json(data);
  });

  app.post('/api/sessions/:id/messages', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<PromptRequestBody>();
    if (!body.text) return c.json({ error: 'text is required' }, 400);

    const { data, error } = await api.session.prompt({
      path: { id },
      body: {
        parts: [{ type: 'text', text: body.text }],
        model: body.model,
        agent: body.agent,
      },
    });
    if (error) return c.json({ error }, 500);
    return c.json(data, 201);
  });

  app.post('/api/sessions/:id/abort', async (c) => {
    const id = c.req.param('id');
    const { data, error } = await api.session.abort({ path: { id } });
    if (error) return c.json({ error }, 500);
    return c.json({ ok: data });
  });

  app.post('/api/sessions/:id/command', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ command: string; arguments?: string }>();
    if (!body.command) return c.json({ error: 'command is required' }, 400);

    const { data, error } = await api.session.command({
      path: { id },
      body: { command: body.command, arguments: body.arguments ?? '' },
    });
    if (error) return c.json({ error }, 500);
    return c.json(data);
  });

  app.post('/api/sessions/:id/summarize', async (c) => {
    const id = c.req.param('id');
    const { data, error } = await api.session.summarize({ path: { id } });
    if (error) return c.json({ error }, 500);
    return c.json(data);
  });

  app.post('/api/sessions/:id/init', async (c) => {
    const id = c.req.param('id');
    const { data, error } = await api.session.init({ path: { id } });
    if (error) return c.json({ error }, 500);
    return c.json(data);
  });
}
