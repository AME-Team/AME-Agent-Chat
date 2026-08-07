/**
 * ファイル I/O ポリシーエンジン (要件 #1 §3.4, §4.1; #2 §7.1)
 *
 * Gatekeeper は bind mount に対する「制御層」。OpenCode のファイル操作・承認要求を
 * ポリシーで評価する。
 *  - Read/Write: 指定ワークスペース内のみ許可 (§3.4)
 *  - Execute: ホスト OS でのシェル/プロセス実行は完全禁止 (§3.4)
 *  - ワークスペース外 / パッケージインストール: 承認が必要 (§2.4, #2 §7.1)
 *  - パストラバーサル対策: ワークスペース外アクセスを確実ブロック (§4.1)
 */
import { isAbsolute, relative, resolve } from 'node:path';
import { env } from 'node:process';

export type PolicyAction = 'allow' | 'approval' | 'deny';
export type PermissionKind = 'read' | 'write' | 'execute' | 'package-install' | string;

export interface PolicyInput {
  type: PermissionKind;
  path?: string;
  command?: string;
  description?: string;
}

export interface PolicyDecision {
  action: PolicyAction;
  reason: string;
}

/** ワークスペースルート (環境変数 or app_settings で設定) */
export function workspaceRoot(): string {
  return env.AME_WORKSPACE_ROOT ?? '';
}

/** パストラバーサル対策: 指定パスがワークスペース内かを判定 (§4.1) */
export function isWithinWorkspace(path: string | undefined, root: string): boolean {
  if (!path || !root) return false;
  const resolved = resolve(path);
  const rel = relative(root, resolved);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

const INSTALL_RE = /(^|\s)(pip|npm|pnpm|yarn|apt(-get)?|brew|gem)\s+.*install/i;
const SHELL_RE = /(^|\s)(bash|sh|zsh|powershell|pwsh|cmd)(\s|$)/i;

/** ポリシー判定 */
export function classify(input: PolicyInput): PolicyDecision {
  const { type, path, command, description } = input;
  const text = `${command ?? ''} ${description ?? ''}`.trim();

  // ホスト OS での実行は完全禁止 (要件 §3.4) — コンテナ内での実行は許可対象外
  if (type === 'execute' || SHELL_RE.test(text)) {
    return { action: 'deny', reason: 'ホスト OS でのシェル/プロセス実行は禁止 (要件 §3.4)' };
  }

  // パッケージインストールは承認が必要 (#2 §7.1)
  if (type === 'package-install' || INSTALL_RE.test(text)) {
    return { action: 'approval', reason: 'パッケージインストールは承認が必要 (#2 §7.1)' };
  }

  // ワークスペース外アクセスは承認が必要 (#2 §7.1)
  if (path && !isWithinWorkspace(path, workspaceRoot())) {
    return { action: 'approval', reason: 'ワークスペース外アクセスは承認が必要 (#2 §7.1)' };
  }

  // ワークスペース内 Read/Write は許可 (要件 §3.4)
  return { action: 'allow', reason: 'ワークスペース内の操作 (要件 §3.4)' };
}
