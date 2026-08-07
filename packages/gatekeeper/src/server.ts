/**
 * Gatekeeper API (要件 #1 §2.1, §3.4, §5) — 永続化・検索・設定エンドポイント (#6)
 *
 * Windows ホスト上 (ポート 58780) で動作。SQLite にセッション/メッセージ/設定を永続化。
 * ファイル I/O 制御・承認フローは #13 で追加する。
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema.js';
import { createSessionRepo, type SessionSort } from './db/repos/sessions.js';
import { createMessageRepo } from './db/repos/messages.js';
import { createSettingsRepo } from './db/repos/settings.js';
import { createApprovalRepo, type ApprovalStatus } from './db/repos/approvals.js';
import { classify, workspaceRoot } from './policy.js';

type Db = BetterSQLite3Database<typeof schema>;

export function createApp(db: Db): Hono {
  const sessions = createSessionRepo(db);
  const messages = createMessageRepo(db);
  const settings = createSettingsRepo(db);
  const approvals = createApprovalRepo(db);

  const app = new Hono();
  app.use('*', logger());
  app.use(
    '/api/*',
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:51730',
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    }),
  );

  app.get('/health', (c) =>
    c.json({
      status: 'ok',
      name: 'ame-agent-chat/gatekeeper',
      timestamp: new Date().toISOString(),
    }),
  );

  // ---- sessions ----
  app.get('/api/sessions', async (c) => {
    const sort = (c.req.query('sort') as SessionSort) ?? 'updated';
    const q = c.req.query('q') ?? '';
    return c.json(await sessions.list(sort, q));
  });

  app.post('/api/sessions', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const row = await sessions.create({
      title: typeof body.title === 'string' ? body.title : undefined,
    });
    return c.json(row, 201);
  });

  app.get('/api/sessions/:id', async (c) => {
    const row = await sessions.get(c.req.param('id'));
    return row ? c.json(row) : c.json({ error: 'not found' }, 404);
  });

  app.patch('/api/sessions/:id', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const patch: { title?: string; pinned?: boolean } = {};
    if (typeof body.title === 'string') patch.title = body.title;
    if (typeof body.pinned === 'boolean') patch.pinned = body.pinned;
    const row = await sessions.update(c.req.param('id'), patch);
    return row ? c.json(row) : c.json({ error: 'not found' }, 404);
  });

  app.delete('/api/sessions/:id', async (c) => {
    await sessions.remove(c.req.param('id'));
    return c.json({ ok: true });
  });

  // ---- messages ----
  app.get('/api/sessions/:id/messages', async (c) =>
    c.json(await messages.listBySession(c.req.param('id'))),
  );

  app.post('/api/sessions/:id/messages', async (c) => {
    const sessionId = c.req.param('id');
    const session = await sessions.get(sessionId);
    if (!session) return c.json({ error: 'session not found' }, 404);
    const body = await c.req.json().catch(() => ({}));
    if (!['user', 'assistant', 'system'].includes(body.role)) {
      return c.json({ error: 'role must be user|assistant|system' }, 400);
    }
    const row = await messages.add({
      sessionId,
      role: body.role as 'user' | 'assistant' | 'system',
      content: body.content ?? '',
      provider: body.provider,
      model: body.model,
      reasoningEffort: body.reasoningEffort,
    });
    return c.json(row, 201);
  });

  app.patch('/api/sessions/:id/messages/:messageId', async (c) => {
    const { id: sessionId, messageId } = c.req.param();
    const msg = await messages.get(messageId);
    if (!msg || msg.sessionId !== sessionId) return c.json({ error: 'message not found' }, 404);
    const body = await c.req.json().catch(() => ({}));
    await messages.setPinned(messageId, body.pinned === true);
    return c.json({ ok: true });
  });

  app.delete('/api/sessions/:id/messages/:messageId', async (c) => {
    const { id: sessionId, messageId } = c.req.param();
    const msg = await messages.get(messageId);
    if (!msg || msg.sessionId !== sessionId) return c.json({ error: 'message not found' }, 404);
    await messages.remove(messageId);
    return c.json({ ok: true });
  });

  // ---- settings ----
  app.get('/api/settings', async (c) => c.json(await settings.getAll()));

  app.put('/api/settings', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === 'string') await settings.set(key, value);
      else await settings.set(key, JSON.stringify(value));
    }
    return c.json({ ok: true });
  });

  // ---- policy ----
  app.get('/api/policy/workspace', (c) => c.json({ workspaceRoot: workspaceRoot() || null }));

  app.post('/api/policy/validate', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const path = typeof body.path === 'string' ? body.path : undefined;
    const decision = classify({ type: body.type ?? 'read', path, command: body.command });
    return c.json({ path, ...decision });
  });

  // ---- approvals (要件 #2 §7) ----
  // 承認リクエスト登録 (agent-core が permission.updated 受信時に呼ぶ) — ポリシー判定を付与
  app.post('/api/approvals', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : crypto.randomUUID();
    const decision = classify({
      type: body.type ?? 'read',
      path: body.path,
      command: body.command,
      description: body.description,
    });
    const row = await approvals.create({
      id,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : '',
      messageId: body.messageId,
      permissionId: body.permissionId ?? id,
      type: body.type ?? 'read',
      path: body.path,
      command: body.command,
      description: body.description,
      policy: decision.action,
      policyReason: decision.reason,
    });
    return c.json(row, 201);
  });

  // 保留中リクエスト一覧
  app.get('/api/approvals', async (c) => {
    const status = c.req.query('status');
    const rows = status
      ? await approvals.listByStatus(status as ApprovalStatus)
      : await approvals.history(Number(c.req.query('limit') ?? 50));
    return c.json(rows);
  });

  // 承認/拒否/ホワイトリスト化 (#2 §7.2)
  app.post('/api/approvals/:id/decision', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const status =
      body.approved === false ? 'rejected' : body.whitelist ? 'whitelisted' : 'approved';
    const row = await approvals.get(c.req.param('id'));
    if (!row) return c.json({ error: 'approval not found' }, 404);
    await approvals.decide(row.id, status);
    return c.json({ ...(await approvals.get(row.id)), ok: true });
  });

  // 承認履歴 (監査性 #2 §7.2)
  app.get('/api/approvals/history', async (c) =>
    c.json(await approvals.history(Number(c.req.query('limit') ?? 50))),
  );

  app.notFound((c) => c.json({ error: 'Not Found' }, 404));
  app.onError((err, c) => {
    // 内部情報 (SQL/パス) をクライアントへ露出しない (本番はログのみ)
    console.error(err);
    const detail = process.env.NODE_ENV === 'production' ? undefined : String(err);
    return c.json({ error: 'Internal Server Error', ...(detail ? { message: detail } : {}) }, 500);
  });

  return app;
}
