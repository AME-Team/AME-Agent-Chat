/**
 * 許可(承認)フロー連携 (要件 #2 §7, #1 §2.2, §3.4)
 *
 * - SSE の `permission.updated` を Gatekeeper に登録し、ポリシー判定を取得
 * - 判定を実効化: deny → 自動拒否 / allow → 自動承認 / approval → UI で承認待ち
 * - Frontend の承認/拒否/ホワイトリスト化を OpenCode SDK + Gatekeeper へ反映
 */
import type { Hono } from 'hono';
import type { Permission } from '@opencode-ai/sdk';
import { PATH_BASED_TYPES } from '@ame-agent-chat/shared';
import { callOpencode, getOpencodeClient } from '../opencode.js';
import { resolveCurrentDirectory } from '../cwd.js';
import { env } from '../env.js';

/** Gatekeeper のポリシー判定 */
interface PolicyDecision {
  action: 'allow' | 'approval' | 'deny';
  reason?: string;
}

/** permission.updated を Gatekeeper へ登録し、ポリシー判定を返す */
export async function registerPermission(
  permission: Permission,
): Promise<PolicyDecision | undefined> {
  try {
    // edit 等の pattern は worktree 相対パスのため、絶対パスが入る metadata.filepath を優先する。
    // pattern は配列で届くことがあるため、Gatekeeper の配列対応 (toPatterns) を活かして
    // 全てのパスを判定対象として送る (bash の pattern (コマンド文字列) は path として送らない)
    const path = PATH_BASED_TYPES.has(permission.type)
      ? ((permission.metadata?.filepath as string | undefined) ?? permission.pattern)
      : undefined;
    // bash のコマンドは metadata.command に入るが、欠落時 (undefined / 空文字) は pattern
    // (コマンド文字列) をフォールバックとして送り、Gatekeeper のインストール/シェル判定の
    // すり抜けを防ぐ。ファイル操作 (PATH_BASED_TYPES) では command を空のまま送る。
    const patternCmd =
      !PATH_BASED_TYPES.has(permission.type) && permission.pattern !== undefined
        ? Array.isArray(permission.pattern)
          ? permission.pattern.join(' ')
          : permission.pattern
        : undefined;
    const rawCommand = permission.metadata?.command;
    const command =
      typeof rawCommand === 'string' && rawCommand.length > 0 ? rawCommand : (patternCmd ?? '');
    // ワークスペース解決の失敗が承認フロー自体を止めないよう、取得できなければ省略する
    // (Gatekeeper は未指定時に保存済み/既定のルートへフォールバックする)。
    let workspaceRoot = '';
    try {
      workspaceRoot = await resolveCurrentDirectory();
    } catch {
      workspaceRoot = '';
    }
    const res = await fetch(`${env.gatekeeperUrl}/api/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: permission.id,
        sessionId: permission.sessionID,
        messageId: permission.messageID,
        permissionId: permission.id,
        type: permission.type,
        path,
        command,
        description: permission.title ?? '',
        // 診断・照合の参考として送る。エージェント申告値は境界判定に非採用で、ワークスペース
        // ルートは Gatekeeper 側 resolveWorkspaceRoot が解決する (判定はサーバー起点)。
        // 送信値はサーバーが有効ルートと食い違う場合にのみ不一致警告ログ (診断) へ使われる。
        workspaceRoot,
      }),
    });
    if (!res.ok) {
      console.error(`[permissions] Gatekeeper register failed: ${res.status}`);
      return undefined;
    }
    const row = (await res.json()) as { policy: PolicyDecision['action']; policy_reason?: string };
    return { action: row.policy, reason: row.policy_reason };
  } catch (err) {
    // 監査レコード消失を無音にしない (要件 #2 §7.2)
    console.error('[permissions] Gatekeeper unreachable:', String(err));
    return undefined;
  }
}

/** OpenCode へ許可応答を送信 (once=承認 / always=常に許可 / reject=拒否) */
async function respond(
  sessionId: string,
  permissionId: string,
  response: 'once' | 'always' | 'reject',
): Promise<void> {
  const { error } = await callOpencode(() =>
    getOpencodeClient().postSessionIdPermissionsPermissionId({
      path: { id: sessionId, permissionID: permissionId },
      body: { response },
    }),
  );
  if (error) console.error(`[permissions] respond ${response} failed:`, error);
}

/**
 * ポリシー判定を実効化して OpenCode へ応答。
 * 戻り値: UI 表示が必要な判定 ('approval') かどうか。
 */
export async function enforcePermission(permission: Permission): Promise<{
  show: boolean;
  action?: PolicyDecision['action'];
}> {
  const decision = await registerPermission(permission);
  const action = decision?.action;

  if (action === 'deny') {
    // ホスト OS 実行等はポリシー上禁止 → 自動拒否 (要件 §3.4)
    await respond(permission.sessionID, permission.id, 'reject');
    return { show: false, action };
  }
  if (action === 'allow') {
    // ワークスペース内 Read/Write は許可 → 自動承認 (§3.4)
    await respond(permission.sessionID, permission.id, 'once');
    return { show: false, action };
  }
  // approval (または判定不可) → ユーザー承認待ち
  return { show: true, action };
}

export function registerPermissionRoutes(app: Hono): void {
  // 承認/拒否/ホワイトリスト化 → OpenCode へ応答 + Gatekeeper へ記録 (#2 §7.2)
  app.post('/api/permissions/:id/decision', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    const permissionId = c.req.param('id');
    const approved = body.approved !== false;
    const whitelist = body.whitelist === true;
    const response = approved ? (whitelist ? 'always' : 'once') : 'reject';

    if (!sessionId) return c.json({ error: 'sessionId is required' }, 400);

    await respond(sessionId, permissionId, response);

    // Gatekeeper に判定を記録 (監査性 #2 §7.2)
    await fetch(`${env.gatekeeperUrl}/api/approvals/${permissionId}/decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, whitelist }),
    }).catch((err) =>
      console.error('[permissions] Gatekeeper decision record failed:', String(err)),
    );

    return c.json({ ok: true, response });
  });

  // 承認履歴 (監査性 #2 §7.2) — Gatekeeper から取得して中継 (配列であることを検証)
  app.get('/api/permissions/history', async (c) => {
    const res = await fetch(
      `${env.gatekeeperUrl}/api/approvals/history?limit=${Number(c.req.query('limit') ?? 50)}`,
    ).catch(() => null);
    if (!res) return c.json({ error: 'gatekeeper unavailable' }, 503);
    const data = await res.json().catch(() => null);
    if (!res.ok)
      return c.json({ error: 'gatekeeper error', message: data }, res.status as 200 | 400 | 500);
    if (!Array.isArray(data)) return c.json({ error: 'invalid gatekeeper response' }, 502);
    return c.json(data);
  });
}
