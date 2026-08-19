/**
 * ファイル I/O ポリシーエンジン (要件 #1 §3.4, §4.1; #2 §7.1)
 *
 * Gatekeeper は bind mount に対する「制御層」。OpenCode のファイル操作・承認要求を
 * ポリシーで評価する。
 *  - Read/Write: 指定ワークスペース内のみ許可 (§3.4)
 *  - Execute: ホスト OS でのシェル/プロセス実行は完全禁止 (§3.4)
 *  - ワークスペース外 / パッケージインストール: 承認が必要 (§2.4, #2 §7.1)
 *  - パストラバーサル対策: ワークスペース外アクセスを確実ブロック (§4.1)
 *
 * 判定はエージェント (agent-core) が送る承認リクエストごとに実行される。
 * opencode の bash 権限は pattern がコマンド文字列 (配列の場合もある) のため、
 * パス判定はファイル操作種別 (read/edit/write/patch/glob/grep/external_directory) に限定する。
 */
import { realpathSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { PATH_BASED_TYPES } from '@ame-agent-chat/shared';

export type PolicyAction = 'allow' | 'approval' | 'deny';
export type PermissionKind = 'read' | 'write' | 'execute' | 'package-install' | string;

export interface PolicyInput {
  type: PermissionKind;
  /** 操作対象 (opencode の pattern)。ファイル操作では絶対/相対パス、bash ではコマンド文字列 */
  path?: string | string[];
  command?: string;
  description?: string;
}

export interface PolicyDecision {
  action: PolicyAction;
  reason: string;
}

/** パストラバーサル対策: 指定パスがワークスペース内かを判定 (§4.1)
 *  relative パスはルート起点で解決する (gatekeeper の CWD に依存させない)。
 *  symlink がワークスペース外を指す場合に実体で判定するため、既存パスは realpath で
 *  実体を解決する (存在しないパスは文字列ベースへフォールバック)。 */
export function isWithinWorkspace(path: string | undefined, root: string): boolean {
  if (!path || !root) return false;
  let rootReal = root;
  try {
    rootReal = realpathSync(root);
  } catch {
    rootReal = resolve(root);
  }
  const base = isAbsolute(path) ? path : resolve(root, path);
  let resolved = base;
  try {
    resolved = realpathSync(base);
  } catch {
    resolved = base;
  }
  const rel = relative(rootReal, resolved);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

// パッケージマネージャの操作を捕捉する。
//  - 連鎖 (&& / ; / ||) は前処理で分割されるため、各セグメント先頭トークンがパッケージ
//    マネージャであるコマンドのみを対象にする (git commit -m "npm install 手順" 等は除外)。
//  - install/add/uninstall/remove/prune と短縮形 (i / ci / add) を承認対象にする (#2 §7.1)。
//  - python -m pip install / uv pip install のような間接形式、npx <pkg> install も対象にする。
const INSTALL_RE =
  /^\s*(pip3?|pipx|npm|pnpm|yarn|bun|apt(-get)?|brew|gem|uv|poetry|cargo|go|conda|mamba)\b.*\b(install|add|uninstall|remove|prune)(\s|$)|^\s*(npm|pnpm|yarn)\s+(i|ci)\b|^\s*npx\s+[\w@./-]+\s+install\b|^\s*python3? -m (pip|uv)\s+(install|add)\b/i;
// シェル/インタプリタ実行はホスト OS での実行禁止対象 (eval は任意コマンドを実行するため含める)
const SHELL_RE = /(^|\s)(bash|sh|zsh|ksh|tcsh|csh|fish|dash|ash|powershell|pwsh|cmd|eval)(\s|$)/i;
// インライン任意コード実行 (python -c / node -e / --eval / -p / perl -e / ruby -e 等) は、
// ファイル実行と区別して承認対象とする (シェルに代わる任意コマンド実行のため)。
const INLINE_CODE_RE =
  /^\s*(python3?|node|perl|ruby|php)\s+(-{1,2}\w+\s+)*(--eval|-e|-c|-p|-pe)\s+/i;

// 破壊的操作 (bash の非該当コマンドを自動 allow してしまわないための安全網)。
// ワークスペース内外に関わらず承認ダイアログを出す (approval)。
//  Windows の format は先頭トークン判定のため pnpm format 等との衝突は起きない (後者は先頭が pnpm)。
//
// 前提: opencode の bash は commit の pattern がコマンド文字列。判定はコマンド先頭トークンに
// 基づく (git mv 等の前置き付きコマンドまで破壊的と誤判定しないようにする)。

// 先頭トークンが破壊的コマンドのワード (mv / dd / mkfs / wipefs / 再起動系 / プロセス強制終了系 /
// Windows の削除・フォーマット系)
const DESTRUCTIVE_LEADING_RE =
  /^\s*(mv|dd|mkfs(\.[a-z-]+)?|wipefs|shutdown|reboot|halt|poweroff|pkill|killall|taskkill|del|rmdir|format)\b/i;
// rm は再帰/強制/パスを問わず削除操作として常に承認 (git rm 等は先頭トークンが git のため除外)
const DESTRUCTIVE_RM = /^\s*rm\b/i;
// システムパス (/etc /usr /var /bin /sbin、Windows ドライブレター) への上書きリダイレクト。
// 通常の /dev/null /tmp へのリダイレクト (/dev/null,2>&1 等) は対象外にして過剰承認を避ける。
const DESTRUCTIVE_REDIRECT =
  /(^|[;|&\s]*)(>|>>)\s*(\/etc|\/usr|\/var|\/bin|\/sbin\/|[A-Za-z]:[\\/])/;
// システムパスを引数に取る書き込み系コマンド (cp/tee/install/ln/curl -o 等)。
// リダイレクトを使わずシステムパスを上書きする操作も承認対象にする。
const DESTRUCTIVE_WRITE =
  /^\s*(cp|tee|install|ln|curl|wget|mv)\b[^\n]*\s(?:-{1,2}\w+\s+)*(-o\s+)?(\/etc|\/usr|\/var|\/bin|\/sbin\/|[A-Za-z]:[\\/])/i;
// 直接スクリプト実行 (./script.sh 等)。引数付きの一般コマンドとは区別して補足する。
const DIRECT_EXEC_RE = /^\s*\.\/([\w./-]+)/i;
// git の破壊的操作 (未追跡強制削除 / 変更破棄 / リセット) は承認対象。
//  dry-run は非破壊のため強制フラグ (f) を含む clean のみに限定し、誤承認を避ける。
//  checkout -- file / checkout . / restore <path> (--staged 以外) 等の変更破棄も対象。
const DESTRUCTIVE_GIT_RE =
  /^\s*git\s+(clean\s+-[a-zA-Z]*f|reset\s+--hard|checkout\s+--\s|checkout\s+\.($|\s)|restore\s+\.($|\s)|restore\s+--source|restore\s+--worktree\s+\S+|restore\s+[^\s-]\S*)/i;
// コマンド置換・バッククォート・間接削除等の安全判定が困難な構文は fail-closed で承認にする。
//  - $() 置換 / バッククォート (echo $(rm -rf) 等) は内容を静的に確実に判定できない。
//  - find -delete / xargs rm 等の間接削除も allow にすると破壊操作がすり抜ける。
const INDIRECT_EXEC_RE = /\$\(|`|find\s+.*-delete\b|find\s+.*-exec\b|xargs\s+(rm|rmdir)\b/i;

/** パスとして扱う権限種別は shared の単一情報源 (PATH_BASED_TYPES) を参照する */

/** コマンドとして扱う既知の安全な非パス種別 (bash 本体と、破壊的判定を通ったときに allow してよい種別)。
 *  bash は main コマンド種別であり、非破壊コマンドを自動実行する。未知の将来種別は fail-closed にする。 */
const SAFE_COMMAND_TYPES = new Set([
  'bash',
  'webfetch',
  'skill',
  'question',
  'websearch',
  'task',
  'lsp',
]);

/** path (string | string[]) を配列に正規化 */
function toPatterns(path: string | string[] | undefined): string[] {
  if (!path) return [];
  return Array.isArray(path) ? path : [path];
}

/** ポリシー判定 */
export function classify(input: PolicyInput, root: string): PolicyDecision {
  const { type, path, command } = input;
  const isPathType = PATH_BASED_TYPES.has(type);

  // ホスト OS での実行は完全禁止 (要件 §3.4) — コンテナ内での実行は許可対象外
  if (type === 'execute') {
    return { action: 'deny', reason: 'ホスト OS でのシェル/プロセス実行は禁止 (要件 §3.4)' };
  }

  // パッケージインストール (種別で明示された場合) は承認が必要 (#2 §7.1)
  if (type === 'package-install') {
    return { action: 'approval', reason: 'パッケージインストールは承認が必要 (#2 §7.1)' };
  }

  // コマンド判定 (シェル/インストール/破壊的操作/直接実行) は bash 等の非パス種別に適用する。
  //  - deny 判定 (SHELL_RE) は command + pattern (bash のコマンド文字列) のみに絞り、
  //    description (タイトル) 由来で誤 deny しないようにする。
  //  - ファイル操作 (edit/read 等): title/パスがコマンド文字列と誤判定されないよう、
  //    コマンドヒューリスティクスは適用しない (ワークスペース判定のみ)。
  if (!isPathType) {
    // コマンド判定は description (タイトル) を含めない。bash のタイトルに破壊的語句が
    // あっても過剰承認しないよう、command + pattern (実際のコマンド文字列) のみで判定する。
    const execText = `${command ?? ''} ${toPatterns(path).join(' ')}`.trim();

    // ホスト OS でのシェル/インタプリタ実行は完全禁止 (要件 §3.4)
    if (SHELL_RE.test(execText)) {
      return { action: 'deny', reason: 'ホスト OS でのシェル/プロセス実行は禁止 (要件 §3.4)' };
    }

    // `sudo rm -rf /` や `cd x && rm -rf` 等の破壊的コマンドを、前置き・連鎖を除いて
    // 各セグメントで判定する (sudo/doas 前置きの除去、&&/;/|| での分割)。
    const segments = execText
      .split(/\s*(?:&&|\|\||;)\s*/)
      .map((s) => s.trim().replace(/^(sudo|doas)\s+/, ''))
      .filter(Boolean);

    // パッケージインストール/除去は承認が必要 (#2 §7.1)
    if (segments.some((s) => INSTALL_RE.test(s))) {
      return { action: 'approval', reason: 'パッケージインストール/除去は承認が必要 (#2 §7.1)' };
    }

    // 破壊的操作/任意コード実行は承認が必要 (自動 allow で破壊的操作がすり抜けないようにする)
    if (
      segments.some(
        (s) =>
          DESTRUCTIVE_LEADING_RE.test(s) ||
          DESTRUCTIVE_RM.test(s) ||
          DESTRUCTIVE_REDIRECT.test(s) ||
          DESTRUCTIVE_WRITE.test(s) ||
          DIRECT_EXEC_RE.test(s) ||
          DESTRUCTIVE_GIT_RE.test(s) ||
          INLINE_CODE_RE.test(s),
      )
    ) {
      return { action: 'approval', reason: '破壊的操作 (削除/上書き/再起動等) は承認が必要' };
    }

    // コマンド置換・間接削除等は安全を静的に検証できないため fail-closed で承認にする
    if (INDIRECT_EXEC_RE.test(execText)) {
      return { action: 'approval', reason: 'コマンド置換/間接実行を含むため承認が必要' };
    }

    // 既知の安全な非パス種別 (webfetch/skill 等) のみ allow。未知種別は fail-closed.
    if (!SAFE_COMMAND_TYPES.has(type)) {
      return { action: 'approval', reason: '種別が不明/未登録なため承認が必要' };
    }
  }

  // パスベース操作 (edit/read 等) でパス情報が欠落している場合は境界を検証できないため
  // 安全側に倒す (fail-closed)。ワークスペース外アクセスは承認待ちにする (#2 §7.1)
  if (isPathType && toPatterns(path).length === 0) {
    return { action: 'approval', reason: 'パス情報が不明なため承認が必要' };
  }
  if (isPathType && toPatterns(path).some((p) => !isWithinWorkspace(p, root))) {
    return { action: 'approval', reason: 'ワークスペース外アクセスは承認が必要 (#2 §7.1)' };
  }

  // ワークスペース内 Read/Write は許可 (要件 §3.4)
  return { action: 'allow', reason: 'ワークスペース内の操作 (要件 §3.4)' };
}
