/**
 * Git 連携: /undo /redo とファイル差分 (要件 #2 §5, §6, §8)
 *
 * ワークスペースは Git リポジトリ前提。OpenCode SDK の revert/unrevert/diff をラップ。
 */
import type { Hono } from 'hono';
import { callOpencode, getOpencodeClient } from '../opencode.js';
import { withDirectory } from '../cwd.js';

export function registerGitRoutes(app: Hono): void {
  const api = getOpencodeClient();

  // ファイル変更差分 (Git diff) — 要件 #2 §8
  app.get('/api/sessions/:id/diff', async (c) => {
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.diff({ path: { id: c.req.param('id') }, query: withDirectory() }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  // /undo: 指定メッセージへ revert (ファイル変更含む) — 要件 #2 §5, §6
  app.post('/api/sessions/:id/revert', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.messageID !== 'string') return c.json({ error: 'messageID is required' }, 400);
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.revert({
        path: { id: c.req.param('id') },
        body: { messageID: body.messageID },
        query: withDirectory(),
      }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  // /redo: revert 後のやり直し (unrevert) — 要件 #2 §5
  app.post('/api/sessions/:id/unrevert', async (c) => {
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.unrevert({ path: { id: c.req.param('id') }, query: withDirectory() }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });
}
