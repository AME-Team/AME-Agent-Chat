/**
 * カレントディレクトリ管理 (Issue #56)
 *
 * opencode Server は複数プロジェクト (ワークスペース) を directory 指定で扱える。
 * 本モジュールが選択中のディレクトリを保持し、各 SDK 呼び出しへ directory として注入する。
 * 選択値は Gatekeeper の app_settings (currentDirectory) へ永続化し、再起動後も復元する。
 */
import { env } from './env.js';
import { callOpencode, getOpencodeClient } from './opencode.js';
import { log } from './logger.js';

let currentDirectory: string | undefined;
let loaded = false;
let loadedAt = 0;
/** 外部 (手動編集等) での変更も拾うための再読込間隔 */
const RELOAD_TTL_MS = 5 * 60 * 1000;
/** 復元試行の間隔制御 (Gatekeeper ダウン時でも API が停滞しないように) */
let lastAttemptAt = 0;

/** SDK 呼び出しの query へ directory を注入するヘルパー */
export function withDirectory(): { directory?: string } {
  return currentDirectory ? { directory: currentDirectory } : {};
}

/** Gatekeeper から保存済みディレクトリを復元 (失敗時は次回リクエストで再試行) */
export async function ensureCurrentDirectoryLoaded(): Promise<void> {
  if (loaded && Date.now() - loadedAt < RELOAD_TTL_MS) return;
  if (currentDirectory && Date.now() - loadedAt < RELOAD_TTL_MS) return;
  // 直近 2 秒以内の試行はスキップ (再試行を抑制しつつ、復旧時に速やかに反映する)
  if (Date.now() - lastAttemptAt < 2000) return;
  lastAttemptAt = Date.now();
  try {
    const res = await fetch(`${env.gatekeeperUrl}/api/settings`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return;
    const settings = (await res.json()) as Record<string, string>;
    const saved = settings.currentDirectory;
    if (saved && typeof saved === 'string') {
      currentDirectory = saved;
      log.debug(`current directory restored: ${saved}`);
    }
    loaded = true;
    loadedAt = Date.now();
  } catch {
    // Gatekeeper 未起動などの一時失敗では loaded を立てず、次回リクエストで再試行する
    log.debug('current directory restore deferred (gatekeeper unavailable)');
  }
}

/** サーバ起動時に永続化済みディレクトリを復元 (#56) */
export async function initCurrentDirectory(): Promise<void> {
  await ensureCurrentDirectoryLoaded();
}

/** 選択中のディレクトリ (未選択時は opencode のカレントプロジェクト) */
export async function resolveCurrentDirectory(): Promise<string> {
  await ensureCurrentDirectoryLoaded();
  if (currentDirectory) return currentDirectory;
  const result = await callOpencode(() => getOpencodeClient().project.current({}));
  if (!result.error && result.data?.worktree) return result.data.worktree;
  return '';
}

/** opencode が認識しているプロジェクト一覧 */
export async function listProjects(): Promise<string[]> {
  const result = await callOpencode(() => getOpencodeClient().project.list({}));
  if (result.error || !Array.isArray(result.data)) return [];
  return result.data
    .map((p) => p?.worktree)
    .filter((w): w is string => typeof w === 'string' && w.length > 0);
}

/** Gatekeeper の実状態とメモリ状態を再同期 (PUT 失敗時の状態不整合対策) */
async function reconcileCurrentDirectory(): Promise<void> {
  try {
    const res = await fetch(`${env.gatekeeperUrl}/api/settings`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return;
    const settings = (await res.json()) as Record<string, string>;
    const saved = settings.currentDirectory;
    if (saved && typeof saved === 'string') currentDirectory = saved;
  } catch {
    /* 再検証失敗時は現状維持 */
  }
}

/** ディレクトリ選択を反映 (state 更新 + Gatekeeper 永続化) */
export async function applyCurrentDirectory(directory: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${env.gatekeeperUrl}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentDirectory: directory }),
      signal: AbortSignal.timeout(1500),
    });
  } catch (err) {
    // timeout 等で Gatekeeper 側が保存済みの可能性があるため実状態で補正する
    await reconcileCurrentDirectory();
    log.warn('failed to persist current directory to gatekeeper', String(err));
    throw err;
  }
  if (!res.ok) {
    // Gatekeeper が 4xx/5xx を返した場合は成功とみなさず呼び出し元へ伝播する
    await reconcileCurrentDirectory();
    log.warn(`failed to persist current directory (status ${res.status})`);
    throw new Error(`gatekeeper persist failed: ${res.status}`);
  }
  currentDirectory = directory;
  log.debug(`current directory set: ${directory}`);
}
