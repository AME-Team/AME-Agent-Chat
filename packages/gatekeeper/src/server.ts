/**
 * Gatekeeper API (要件 #1 §2.1, §3.4, §5) — 永続化・検索・設定エンドポイント (#6)
 *
 * ホスト OS 上 (ポート 58780) で動作。SQLite にセッション/メッセージ/設定を永続化。
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
import { createUsageRepo } from './db/repos/usage.js';
import { classify } from './policy.js';

type Db = BetterSQLite3Database<typeof schema>;

export function createApp(db: Db): Hono {
  const sessions = createSessionRepo(db);
  const messages = createMessageRepo(db);
  const settings = createSettingsRepo(db);
  const approvals = createApprovalRepo(db);
  const usage = createUsageRepo(db);

  /** ポリシー判定のワークスペースルート。
   *  env → 保存済み currentDirectory → 起動時 CWD の順で解決する。
   *  エージェントの申告 (agentRoot) は境界保護をエージェントの自己申告に委ねないため
   *  採用しない (agent-core は選択ディレクトリを currentDirectory へ永続化する (#56))。 */
  async function resolveWorkspaceRoot(agentRoot?: string): Promise<string> {
    const envRoot = process.env.AME_WORKSPACE_ROOT;
    if (envRoot) return envRoot;
    const saved = await settings.get('currentDirectory');
    if (saved) {
      if (agentRoot && agentRoot !== saved) {
        console.warn(
          `[gatekeeper] ignored agent-reported workspaceRoot '${agentRoot}' (configured: '${saved}')`,
        );
      }
      return saved;
    }
    return process.cwd();
  }

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
  app.get('/api/policy/workspace', async (c) =>
    c.json({ workspaceRoot: await resolveWorkspaceRoot() }),
  );

  app.post('/api/policy/validate', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    // approvals と契約を揃えるため、配列パスは配列のまま classify へ渡す
    // (要素ごとの境界判定が失われないようにする。join は表示用のみ)。
    const rawPath =
      typeof body.path === 'string' || Array.isArray(body.path) ? body.path : undefined;
    const root = await resolveWorkspaceRoot();
    const decision = classify(
      { type: body.type ?? 'read', path: rawPath, command: body.command },
      root,
    );
    const path = Array.isArray(rawPath) ? rawPath.join(', ') : rawPath;
    return c.json({ path, ...decision, workspaceRoot: root });
  });

  // ---- approvals (要件 #2 §7) ----
  // 承認リクエスト登録 (agent-core が permission.updated 受信時に呼ぶ) — ポリシー判定を付与
  app.post('/api/approvals', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id : crypto.randomUUID();
    const agentRoot = typeof body.workspaceRoot === 'string' ? body.workspaceRoot : undefined;
    const root = await resolveWorkspaceRoot(agentRoot);
    const decision = classify(
      {
        type: body.type ?? 'read',
        path: body.path,
        command: body.command,
        description: body.description,
      },
      root,
    );
    // 配列パス (glob/grep/external_directory 等) は表示・永続化のため文字列へ正規化する
    const path = Array.isArray(body.path) ? body.path.join(', ') : body.path;
    const row = await approvals.create({
      id,
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : '',
      messageId: body.messageId,
      permissionId: body.permissionId ?? id,
      type: body.type ?? 'read',
      path,
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

  // ---- usage (要件 #1 §3.2.5 / #27) ----
  app.post('/api/usage', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.provider !== 'string' || typeof body.model !== 'string') {
      return c.json({ error: 'provider and model are required' }, 400);
    }
    await usage.record({
      sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
      provider: body.provider,
      model: body.model,
      inputTokens: Number(body.inputTokens ?? 0),
      outputTokens: Number(body.outputTokens ?? 0),
      cost: Number(body.cost ?? 0),
    });
    return c.json({ ok: true }, 201);
  });

  app.get('/api/usage', async (c) => c.json(await usage.aggregate()));

  app.notFound((c) => c.json({ error: 'Not Found' }, 404));
  app.onError((err, c) => {
    // 内部情報 (SQL/パス) をクライアントへ露出しない (本番はログのみ)
    console.error(err);
    const detail = process.env.NODE_ENV === 'production' ? undefined : String(err);
    return c.json({ error: 'Internal Server Error', ...(detail ? { message: detail } : {}) }, 500);
  });

  return app;
}
