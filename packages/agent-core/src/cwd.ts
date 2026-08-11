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
/** 進行中の復元 fetch (並行呼び出しが同一 Promise を await するための共有) */
let inflight: Promise<void> | null = null;
/** ディレクトリ変更 (PUT) の世代。復元 GET の古い応答が新しい PUT を上書きしないためのガード */
let generation = 0;

/** SDK 呼び出しの query へ directory を注入するヘルパー */
export function withDirectory(): { directory?: string } {
  return currentDirectory ? { directory: currentDirectory } : {};
}

/** 有効なカレントディレクトリが設定されているか (復元 or ユーザー選択済み) */
export function isDirectoryReady(): boolean {
  return typeof currentDirectory === 'string' && currentDirectory.length > 0;
}

/** Gatekeeper の設定取得が一度でも成功したか (恒久的未設定 vs 一時失敗の区別用) */
export function settingsOk(): boolean {
  return loaded;
}

/** Gatekeeper の /api/settings から保存済みディレクトリを取得。
 *  - 正常に読めて未保存 → undefined
 *  - 読めなかった (HTTP 4xx/5xx / 通信失敗) → throw (一時失敗として再試行可能) */
async function fetchSavedDirectory(): Promise<string | undefined> {
  const res = await fetch(`${env.gatekeeperUrl}/api/settings`, {
    signal: AbortSignal.timeout(1500),
  });
  if (!res.ok) throw new Error(`settings fetch failed: ${res.status}`);
  const settings = (await res.json()) as Record<string, string>;
  const saved = settings.currentDirectory;
  return saved && typeof saved === 'string' ? saved : undefined;
}

/** Gatekeeper から保存済みディレクトリを復元 (失敗時は次回リクエストで再試行) */
export async function ensureCurrentDirectoryLoaded(): Promise<void> {
  if (loaded && Date.now() - loadedAt < RELOAD_TTL_MS) return;
  if (currentDirectory && Date.now() - loadedAt < RELOAD_TTL_MS) return;
  // 進行中の復元があれば同一 Promise を await し、競合で復元をスキップしない
  if (inflight) return inflight;
  // 直近 2 秒以内の試行はスキップ (再試行を抑制しつつ、復旧時に速やかに反映する)
  if (Date.now() - lastAttemptAt < 2000) return;
  lastAttemptAt = Date.now();
  inflight = (async () => {
    const gen = generation;
    try {
      const saved = await fetchSavedDirectory();
      // fetch 中に新しい PUT が完了していた場合は古い応答で上書きしない
      if (saved && gen === generation) {
        currentDirectory = saved;
        log.debug(`current directory restored: ${saved}`);
      }
      loaded = true;
      loadedAt = Date.now();
    } catch {
      // 読めなかった (初回 or TTL 再取得) → loaded をリセットし次回再試行する。
      // settingsOk() は「直近の取得成功」を返すよう loaded を最新の成否に合わせる
      loaded = false;
      loadedAt = 0;
      log.debug('current directory restore deferred (gatekeeper unavailable)');
    } finally {
      inflight = null;
    }
  })();
  return inflight;
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

/** opencode が認識しているプロジェクト一覧 (worktree の重複は排除) */
export async function listProjects(): Promise<string[]> {
  const result = await callOpencode(() => getOpencodeClient().project.list({}));
  if (result.error || !Array.isArray(result.data)) return [];
  return [
    ...new Set(
      result.data
        .map((p) => p?.worktree)
        .filter((w): w is string => typeof w === 'string' && w.length > 0),
    ),
  ];
}

/** Gatekeeper の実状態とメモリ状態を再同期 (PUT 失敗時の状態不整合対策) */
async function reconcileCurrentDirectory(): Promise<void> {
  // 復元 (restore) が進行中なら先に完了を待ち、直近の設定を取りこぼさない
  await ensureCurrentDirectoryLoaded();
  try {
    const saved = await fetchSavedDirectory();
    if (saved) currentDirectory = saved;
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
  generation++;
  log.debug(`current directory set: ${directory}`);
}
