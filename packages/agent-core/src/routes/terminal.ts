/**
 * ターミナル API (Issue #65)
 *
 * - POST /api/terminal/exec   コマンドをサンドボックス内で実行し出力を返す
 *
 * フロントのターミナルパネル (Ctrl+J) から呼ばれる。OpenCode の session.shell は
 * 単発コマンド実行のため、セッションは内部的に自動作成・保持して再利用する。
 * ※ !Bash と同じサンドボックス (session.shell) で実行するため、承認ダイアログを
 *   介さずにワークスペース内のファイルを変更できる点はドキュメントで明示している。
 */
import type { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { callOpencode, getOpencodeClient } from '../opencode.js';
import { env } from '../env.js';
import { withDirectory } from '../cwd.js';
import { log, safeStringify } from '../logger.js';

/** ターミナル API の共有トークン (Issue #65)。
 *  env.TERMINAL_TOKEN が未指定の場合は起動毎にランダム生成し、フロントは
 *  /api/terminal/token から取得して exec 時に提示する。これにより Origin 偽装のみに
 *  依存せず、別オリジンのローカルサイトからの CSRF を実質的に防ぐ (トークンは CORS で
 *  読めない)。ポート公開環境ではこれに加えネットワーク層 (ループバック束縛等) の防御が必要 */
const TERMINAL_TOKEN = env.terminalToken || randomUUID();
/** トークン取得エンドポイントを呼べるオリジン (exec と同じくループバックのみ) */
const TERMINAL_TOKEN_HEADER = 'x-terminal-token';

/** ターミナル専用セッションのタイトル (ログ・識別用。一意性は保存レジストリで担保) */
export const TERMINAL_SESSION_TITLE = 'AME Terminal';

/** このプロセス (および再起動を跨いだ自プロセス) が作ったターミナル専用セッション ID。
 *  タイトル照合ではなくこの ID で判定するため、ユーザーが同名セッションを作っても
 *  誤除外/誤再利用しない。 */
const terminalSessionIDs = new Set<string>();

export function isTerminalSessionID(id: string): boolean {
  return terminalSessionIDs.has(id);
}

/** ディレクトリ別に自前セッション ID を保存 (再起動後も再利用)。
 *  ユーザー由来のセッションは絶対に混入させない。
 *  ファイル名にポートを含め、同一ホストで複数 agent-core インスタンスが起動しても
 *  セッション ID を共有しない (別インスタンスの opencode セッションへ並行実行されるのを防ぐ)。
 *  権限は 0600 に限定 (セッション ID の漏洩を防ぐ) */
const STORE_PATH = join(tmpdir(), `ame-terminal-sessions-${env.port}.json`);
type TerminalStore = Record<string, string>;

const terminalStore: TerminalStore = (() => {
  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, 'utf8')) as TerminalStore;
    if (parsed && typeof parsed === 'object') {
      for (const id of Object.values(parsed)) terminalSessionIDs.add(id);
      return parsed;
    }
  } catch {
    /* 初回 or 破損: 空で開始 */
  }
  return {};
})();

function saveStore(): void {
  try {
    writeFileSync(STORE_PATH, JSON.stringify(terminalStore), { mode: 0o600 });
  } catch {
    /* 保存失敗は許容 (次回再利用のみ効かなくなる) */
  }
}

function registerTerminalSession(id: string): void {
  terminalSessionIDs.add(id);
}

/** 指定ディレクトリの保存済みターミナルセッションを破棄 (失効時の再作成用) */
function forgetTerminalSession(directory?: string): void {
  const key = directory ?? '';
  const id = terminalStore[key];
  if (id) terminalSessionIDs.delete(id);
  delete terminalStore[key];
  saveStore();
  if (terminalSession && terminalSession.directory === key) terminalSession = null;
}

/** 最新 1 件のターミナルセッションを保持する単一キャッシュ。
 *  ディレクトリ切替に追随するが、永続的な per-directory 再利用は terminalStore が担う */
let terminalSession: { directory?: string; id: string } | null = null;
/** セッション確保中の in-flight Promise (ディレクトリ別に管理し二重作成を防ぐ) */
const ensureInflight = new Map<string, Promise<string>>();

function inflightKey(directory?: string): string {
  return directory ?? '';
}

/**
 * ターミナル API の Origin 検証 (CSRF / なりすり対策)。
 * 任意コマンド実行 API のため、リモート (別オリジン) からの CSRF を防ぐ。
 * - Origin 無し (curl / LAN 等の非ブラウザ) は拒否 (ブラウザ専用エンドポイント)
 * - オリジンがループバック (localhost / 127.0.0.1 / [::1]) なら許可
 *   → ローカルで動くフロントエンドからの要求を許し、evil.com 等のリモートサイトからの
 *     localhost:30010 へ向けた CSRF をブロックする (Origin は偽装可能だが、リモートサイトの
 *     Origin は自ドメインになるためループバックにはならない)
 * - それ以外は corsOrigin の明示リストに一致する場合のみ許可 ('*' はループバックのみに限定し
 *   リモート CSRF を許さない)
 */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  let host: string | undefined;
  try {
    host = new URL(origin).hostname;
  } catch {
    return false;
  }
  const loopback =
    host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  if (loopback) return true;
  const configured = env.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (configured.includes('*')) return false; // リモート CSRF を許さない
  return configured.includes(origin);
}

/** session.shell が「セッション失効」を表すエラーか判定 (リトライ対象の限定) */
function isSessionNotFound(err: unknown): boolean {
  const name = (err as { name?: string })?.name ?? '';
  if (name === 'NotFoundError') return true;
  return safeStringify(err).toLowerCase().includes('session not found');
}

/**
 * ターミナル用セッションを確保する (シングルトン・ディレクトリ別)。
 *  - キャッシュ済み (同一ディレクトリ) ならそれを返す
 *  - cwd が変わっていれば作り直す
 *  - 再起動後も保存済み自前セッション ID を使い回す (タイトル照合はしない)
 */
async function ensureTerminalSession(directory?: string): Promise<string> {
  // ディレクトリ未指定 (undefined) と空文字 ('') を同一キーとして扱うため key に正規化。
  // キャッシュ比較・破棄 (forgetTerminalSession) も key で一致させ、失効後の 500 ループを防ぐ
  const key = inflightKey(directory);
  if (terminalSession && terminalSession.directory === key) return terminalSession.id;
  const inflight = ensureInflight.get(key);
  if (inflight) return inflight;
  const promise = (async () => {
    const api = getOpencodeClient();
    const query = directory ? { directory } : {};
    // 保存済み自前セッションがあればそれを使う。失効時は呼び出し元で
    // forgetTerminalSession してから本関数を再度呼び再作成する
    const savedId = terminalStore[key];
    if (savedId) {
      terminalSession = { directory: key, id: savedId };
      registerTerminalSession(savedId);
      log.debug(`terminal session reused from store: ${savedId}`);
      return savedId;
    }
    const result = await callOpencode(() =>
      api.session.create({
        body: { title: `${TERMINAL_SESSION_TITLE} ${Date.now()}` },
        query,
      }),
    );
    if (result.error || !result.data?.id) {
      // opencode 未起動等は unreachable を伝播し、ハンドラで 503 へマップする
      const unreachable = (result as { unreachable?: boolean }).unreachable;
      const err = new Error('failed to create terminal session');
      if (unreachable) (err as { unreachable?: boolean }).unreachable = true;
      throw err;
    }
    terminalSession = { directory: key, id: result.data.id };
    registerTerminalSession(result.data.id);
    terminalStore[key] = result.data.id;
    saveStore();
    log.debug(`terminal session created: ${result.data.id}`);
    return result.data.id;
  })();
  ensureInflight.set(key, promise);
  try {
    return await promise;
  } finally {
    ensureInflight.delete(key);
  }
}

/** ターミナル実行の安全弁タイムアウト (ms) — 無限に待たずクライアントへ応答を返す */
const EXEC_TIMEOUT_MS = 120_000;

/** ディレクトリ別の実行ロック (ハンドラ冒頭で取得し runShell 完了まで保持)。
 *  これにより ensureTerminalSession の await 前後を含めて同一ディレクトリの並行実行を防ぐ (TOCTOU 回避) */
const runLock = new Map<string, Promise<unknown>>();

/** session.shell をタイムアウト付きで実行する (Promise.race + タイマー解放)。
 *  タイムアウト時は裏の実行を session.abort で停止し、セッションを破棄してロックを解放する。
 *  これで (1) 並行実行による git/pnpm 等の競合を防ぎつつ、(2) ユーザーは agent-core 再起動なしに
 *  別セッションで回復できる (ロックが事実上永久に残るのを避ける) */
async function runShell(
  api: ReturnType<typeof getOpencodeClient>,
  id: string,
  command: string,
  query: { directory?: string },
) {
  const exec = callOpencode(() =>
    api.session.shell({
      path: { id },
      body: { agent: 'build', command },
      query,
    }),
  );
  // Promise.race は入力 Promise 全件を購読するため、タイムアウト後の exec reject でも
  // unhandledRejection は発生しない (race が内部で処理する)
  let timer: NodeJS.Timeout | undefined;
  try {
    const outcome = await Promise.race([
      exec.then((v) => ({ kind: 'done' as const, v })),
      new Promise<{ kind: 'timeout' }>((resolve) => {
        timer = setTimeout(() => resolve({ kind: 'timeout' }), EXEC_TIMEOUT_MS);
      }),
    ]);
    if (outcome.kind === 'timeout') {
      // 裏実行を abort して並行実行を防ぐ。abort 完了 (上限 5s) まで待ってからセッションを
      // 忘れるため、runLock 解放→次コマンド開始のタイミングで古い shell が残る並行実行を避ける
      log.warn(`terminal exec timed out after ${EXEC_TIMEOUT_MS}ms, aborting session ${id}`);
      try {
        await Promise.race([
          callOpencode(() => api.session.abort({ path: { id }, query })),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('abort timed out')), 5_000),
          ),
        ]);
      } catch {
        // abort 失敗: 裏実行が継続中の可能性あり。runLock を外側で解放させないよう、
        // 元の exec が完了するまで (上限 60s) 待機してからタイムアウト例外を投げる。
        // これで「タイムアウト表示されたのに古いプロセスが動き続け並行実行される」を防ぐ
        log.warn('terminal abort failed, waiting for underlying exec to settle');
        await Promise.race([
          exec,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('exec-settle timeout')), 60_000),
          ),
        ]).catch(() => {});
      }
      forgetTerminalSession(query.directory);
      throw new Error(`terminal exec timed out after ${EXEC_TIMEOUT_MS}ms`);
    }
    return outcome.v;
  } finally {
    // exec が先に完了しても安全弁タイマーを残留させない (イベントループ・メモリ対策)
    if (timer) clearTimeout(timer);
  }
}

export function registerTerminalRoutes(app: Hono): void {
  // トークン取得 (フロント起動時に 1 回呼ぶ)。POST は同一オリジンでも Origin が付与されるため
  // exec と同じループバック判定を通る。レスポンスは CORS で他オリジンから読めないため、
  // ループバック上の悪意サイトがトークンを取得できても実行には利用できない (exec はトークン必須)。
  // なお global CORS (server.ts) は origin 文字列指定のため、リクエスト Origin が設定値
  // (既定 http://localhost:51730) と一致する場合のみ ACAO を付与する。よって localhost:9999 等の
  // 別ローカルオリジンには ACAO が付かず、レスポンスを読むことができない (Hono cors 実装確認済み)
  app.post('/api/terminal/token', (c) => {
    if (!isOriginAllowed(c.req.header('origin'))) {
      return c.json({ error: 'origin not allowed' }, 403);
    }
    return c.json({ token: TERMINAL_TOKEN });
  });

  app.post('/api/terminal/exec', async (c) => {
    // CSRF / なりすり対策: 任意コマンド実行 API はブラウザ (フロントエンド) からのみ使用する。
    // Origin ヘッダが無い (curl / LAN 上の任意クライアント等) リクエストは一律拒否し、
    // Docker でポート公開されている agent-core への localhost 越しの悪用を防ぐ。
    const origin = c.req.header('origin');
    if (!isOriginAllowed(origin)) {
      return c.json({ error: 'origin not allowed' }, 403);
    }
    // 共有トークン検証 (Origin に加えた第二の防御)。他オリジンのローカルサイトは CORS で
    // トークンを読めないため、exec を直接叩けない
    if (c.req.header(TERMINAL_TOKEN_HEADER) !== TERMINAL_TOKEN) {
      return c.json({ error: 'invalid terminal token' }, 403);
    }
    const body: { command?: unknown } = await c.req.json().catch(() => ({}));
    const command = typeof body.command === 'string' ? body.command.trim() : '';
    if (!command) return c.json({ error: 'command is required' }, 400);

    const api = getOpencodeClient();
    const query = withDirectory();
    const key = query.directory ?? '';
    // ハンドラ冒頭でディレクトリ単位の実行ロックを取得 (ensure の await 前 → TOCTOU 回避)。
    // 既に実行中なら busy で即返却 (裏実行の完了まで占有させない)
    const existing = runLock.get(key);
    if (existing) {
      return c.json(
        { error: 'terminal busy', message: 'A command is still running for this directory.' },
        409,
      );
    }
    const run = (async () => {
      try {
        let sessionID = await ensureTerminalSession(query.directory);
        let result = await runShell(api, sessionID, command, query);
        // セッション失効 (サーバ再起動・削除) のときだけ再作成して 1 回だけ再実行する。
        // コマンド自体の失敗では二重実行しない (副作用の二重実行を避ける)
        if (result.error && isSessionNotFound(result.error)) {
          log.warn('terminal session stale, recreating', safeStringify(result.error));
          forgetTerminalSession(query.directory);
          sessionID = await ensureTerminalSession(query.directory);
          result = await runShell(api, sessionID, command, query);
        }
        if (result.error) {
          // 内部エラー詳細はクライアントへ返さずログのみ (catch ブロックと方針統一)。
          // opencode への到達不能は 503 へマップ (原因切り分けのため)
          log.error('terminal exec failed', safeStringify(result.error));
          const status = (result as { unreachable?: boolean }).unreachable ? 503 : 500;
          return c.json({ error: 'terminal exec failed' }, status);
        }
        return c.json({ command, output: result.data, sessionID });
      } catch (err) {
        // 内部エラー文字列はクライアントへ返さずログのみに留める (情報漏洩回避)。
        // opencode 未起動等の到達不能は 503 へマップ (result.error 経路と同様)
        log.error('terminal exec error', safeStringify(err));
        const status = (err as { unreachable?: boolean }).unreachable ? 503 : 500;
        return c.json({ error: 'terminal execution failed' }, status);
      }
    })();
    runLock.set(key, run);
    try {
      return await run;
    } finally {
      if (runLock.get(key) === run) runLock.delete(key);
    }
  });
}
