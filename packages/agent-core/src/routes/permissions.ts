/**
 * 許可(承認)フロー連携 (要件 #2 §7, #1 §2.2)
 *
 * - SSE プロキシが受信した `permission.updated` を Gatekeeper に登録(ポリシー判定付与)
 * - Frontend の承認/拒否/ホワイトリスト化を OpenCode SDK + Gatekeeper へ反映
 *
 * ホスト OS での実行禁止は Gatekeeper ポリシー (要件 #1 §3.4) で担保。
 */
import type { Hono } from 'hono';
import { getOpencodeClient } from '../opencode.js';
import { env } from '../env.js';

/** OpenCode の permission.updated ペイロード (Permission) */
interface OpenCodePermission {
  id: string;
  type: string;
  pattern?: string;
  sessionID: string;
  messageID?: string;
  title?: string;
  metadata?: Record<string, unknown>;
}

/** permission.updated を Gatekeeper へ登録 (ポリシー判定は Gatekeeper 側) */
export async function registerPermission(permission: OpenCodePermission): Promise<void> {
  try {
    await fetch(`${env.gatekeeperUrl}/api/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: permission.id,
        sessionId: permission.sessionID,
        messageId: permission.messageID,
        permissionId: permission.id,
        type: permission.type,
        path: permission.pattern,
        command: String(permission.metadata?.command ?? ''),
        description: permission.title ?? '',
      }),
    });
  } catch {
    // Gatekeeper 未起動時はフォワード不可 (SSE はそのまま継続)
  }
}

export function registerPermissionRoutes(app: Hono): void {
  const api = getOpencodeClient();

  // 保留中の承認リクエスト一覧 (Gatekeeper から取得)
  app.get('/api/permissions/pending', async (c) => {
    const res = await fetch(`${env.gatekeeperUrl}/api/approvals?status=pending`);
    if (!res.ok) return c.json({ error: 'gatekeeper unavailable' }, 503);
    return c.json(await res.json());
  });

  // 承認/拒否/ホワイトリスト化 → OpenCode へ応答 + Gatekeeper へ記録
  app.post('/api/permissions/:id/decision', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const approved = body.approved !== false;
    const whitelist = body.whitelist === true;

    // OpenCode への応答: once(承認) / always(常に許可=ホワイトリスト) / reject(拒否)
    const response = approved ? (whitelist ? 'always' : 'once') : 'reject';
    const { error } = await api.postSessionIdPermissionsPermissionId({
      path: { id: c.req.param('id'), permissionID: c.req.param('id') },
      body: { response },
    });
    if (error) return c.json({ error }, 500);

    // Gatekeeper に判定を記録 (監査性 #2 §7.2)
    await fetch(`${env.gatekeeperUrl}/api/approvals/${c.req.param('id')}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, whitelist }),
    }).catch(() => {});

    return c.json({ ok: true, response });
  });
}
