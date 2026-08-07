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
import { resolveTaskModel, shouldCompact } from '../router.js';

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

    // プロンプト圧縮 (#18): 有効時は送信前に履歴を /compact 相当で圧縮
    if (await shouldCompact()) {
      await api.session.summarize({ path: { id } }).catch(() => {});
    }

    // LLM ルーター (#15): 未指定時はルールベースでモデルを選択し注入 (§2.3)
    const routed = body.model ? undefined : await resolveTaskModel(body.text);

    // ※ 推論量は OpenCode SDK の prompt body に直接注入できない (model は providerID/modelID のみ)。
    //   実効推論量を routed.reasoningEffort として返し、表示・記録に利用する (§3.2.1/§3.2.3)。
    const { data, error } = await api.session.prompt({
      path: { id },
      body: {
        parts: [{ type: 'text', text: body.text }],
        model:
          body.model ??
          (routed ? { providerID: routed.providerID, modelID: routed.modelID } : undefined),
        agent: body.agent,
      },
    });
    if (error) return c.json({ error }, 500);
    // レスポンススキーマを常に一定に保つ (model 指定有無で形状を変えない)
    return c.json({ info: data, routed: routed ?? null }, 201);
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
