/**
 * レベル制御ロガー (Issue #55) + ファイル出力 (Issue #73)
 *
 * `LOG_LEVEL` 環境変数 (debug | info | warn | error) で出力を制御する。
 * 開発モード (`pnpm dev`) は scripts/dev.mjs が LOG_LEVEL=debug を伝播するため、
 * リクエスト詳細や SDK 呼び出しのデバッグログが確認できる。
 *
 * コンソール出力に加え、`LOG_FILE` 環境変数 (既定: OS 一時ディレクトリ配下) へも
 * ISO タイムスタンプ付きで追記する。原因調査のためダウンロード API から参照可能。
 * ファイルが最大サイズ (1MB) を超えた場合は `.1` へ 1 世代ローテーションする。
 *
 * ### 同期 I/O を意図的に採用している理由
 * ファイル書き込みは同期 (appendFileSync) を使う。Issue #73 の目的が「クラッシュ原因の
 * 調査」であり、非同期 (appendFile) ではプロセスが直後に死んだ場合にバッファされた
 * ログ行が失われる。同期書き込みはログ呼び出し時点で必ずディスクへ反映されるため、
 * 異常終了の直前行も確実に残る。イベントループのブロッキングはローカル開発用途の
 * ログ量 (リクエスト毎に数行) では無視できる程度であり、順序保証も自明になる。
 * debug が大量に出る局面 (SSE 中の SDK イベント毎のログ) でも行単位の同期追記は
 * 数百 bytes オーダーのため、ストリーミングを詰まらせるほどの影響はないと判断する。
 */
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readSync,
  renameSync,
  statSync,
  truncateSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { env, LOG_LEVELS, type LogLevel } from './env.js';

const threshold = LOG_LEVELS.indexOf(env.logLevel);
/** ログファイルの最大サイズ (超過時は .1 へローテーション) — LOG_MAX_SIZE で変更可能 (Issue #73) */
const MAX_LOG_SIZE = env.logMaxSize;

function enabled(level: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= threshold;
}

function formatLine(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === 'string') return a;
      // Error は JSON.stringify で '{}' になるためスタックを保持する (原因調査用 — Issue #73)
      if (a instanceof Error) return a.stack ?? String(a);
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

/** 起動時に現行ログファイルの初期サイズを把握し、回転判定へ引き継ぐ */
function initialLogSize(): number {
  try {
    return existsSync(env.logFile) ? statSync(env.logFile).size : 0;
  } catch {
    return 0;
  }
}

let writtenBytes = initialLogSize();
/** 直近のローテーション試行時刻 (失敗時の再試行ストーム抑制用) */
let lastRotateAttemptAt = 0;
/** ローテーション失敗後、再試行を抑制する時間 (ms) */
const ROTATE_RETRY_COOLDOWN_MS = 5000;
/** ローテーションの初回失敗を一度だけコンソールへ通知したか (回転停止の可視化) */
let warnedRotateError = false;
/** ローテーションが継続失敗しているか (ファイル肥大時の切り詰めフォールバック判定) */
let rotateDegraded = false;
/** 回転失敗が続く場合のハード上限 (MAX_LOG_SIZE の 10 倍)。超過時は末尾を残して切り詰める */
const MAX_LOG_HARD_LIMIT = MAX_LOG_SIZE * 10;

/**
 * メモリ上の writtenBytes を実ファイルサイズへ再同期する。
 * 外部プロセスによる削除/再作成・OS の掃除・複数インスタンス等でカウンタと実サイズが
 * 乖離しても、ローテーション・ハードリミットの判定が実ファイルに追従するようにする (Issue #73)。
 */
function syncWrittenBytes(): void {
  try {
    writtenBytes = existsSync(env.logFile) ? statSync(env.logFile).size : 0;
  } catch {
    // stat 失敗時は現状維持 (次の追記で再試行)
  }
}

/** 1 世代ローテーション (agent-core.log → agent-core.log.1) */
function rotateLog(): void {
  // 失敗し続けると毎回 renameSync が走り再試行ストームになるため、直近失敗から一定時間は抑止する
  if (Date.now() - lastRotateAttemptAt < ROTATE_RETRY_COOLDOWN_MS) return;
  try {
    // 実ファイルが存在しない (外部削除等) 場合の ENOENT で誤った degrade 警告を出さないよう事前ガード
    if (!existsSync(env.logFile)) {
      writtenBytes = 0;
      return;
    }
    renameSync(env.logFile, `${env.logFile}.1`);
    writtenBytes = 0;
    rotateDegraded = false;
    // 復帰成功時は以降の失敗でも再通知できるよう警告フラグを再アームする (観測性)
    warnedRotateError = false;
  } catch (err) {
    lastRotateAttemptAt = Date.now();
    rotateDegraded = true;
    // 回転失敗時は現行ファイルへ追記を続ける (最悪でも最新ログは残す)。
    // ただし 1 世代ローテーションが機能していないことを一度だけ通知する
    if (!warnedRotateError) {
      warnedRotateError = true;
      console.warn(
        `[agent-core:warn] log rotation disabled (${env.logFile}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

/** 回転が継続失敗しハード上限を超えた場合、末尾 MAX_LOG_SIZE 分を残して現行ファイルを切り詰める (ディスク枯渇防止) */
function truncateLogTail(): void {
  try {
    const size = statSync(env.logFile).size;
    const keep = Math.min(size, MAX_LOG_SIZE);
    const fd = openSync(env.logFile, 'r+');
    try {
      const buf = Buffer.alloc(keep);
      const bytesRead = readSync(fd, buf, 0, keep, size - keep);
      writeSync(fd, buf.subarray(0, bytesRead), 0, bytesRead, 0);
      truncateSync(env.logFile, bytesRead);
      writtenBytes = bytesRead;
    } finally {
      closeSync(fd);
    }
    console.warn(
      `[agent-core:warn] log file truncated to ${writtenBytes} bytes (rotation failing): ${env.logFile}`,
    );
  } catch {
    // 切り詰め失敗時も追記を継続する (最悪でも最新ログは残す)
  }
}

// ディレクトリ作成は起動時に 1 回だけ行う (writeFile では失敗時のみ再試行)
// ログには機微情報が含まれ得るため、ディレクトリは 0700・ファイルは 0600 に限定する
let dirReady = false;
/** ファイル出力の縮退状態 (失敗中)。失敗を一度通知した後、一定間隔で復帰を試みる */
let fileOutputDegraded = false;
/** ファイル出力失敗の初回通知を済ませたか (以後の失敗では再通知しない) */
let warnedFileError = false;
function ensureLogDir(): void {
  if (dirReady) return;
  try {
    mkdirSync(dirname(env.logFile), { recursive: true, mode: 0o700 });
    // 既存ファイル (旧既定 0644 等) のモードも 0600 へ揃える
    if (existsSync(env.logFile)) chmodSync(env.logFile, 0o600);
    dirReady = true;
  } catch {
    // 失敗時は writeFile 側で再試行される
  }
}
ensureLogDir();

/** 一時的な失敗 (ディスク解放・ディレクトリ再作成等) からの復帰を試みる間隔 (ms) */
const FILE_RETRY_INTERVAL_MS = 30_000;
let lastFileRetryAt = 0;

/** 外部プロセス由来の変化を拾うための再同期間隔 (ms)。毎行 statSync するとホットパスで
 *  syscall が増えるため、この間隔で一度だけ実ファイルサイズへ再同期する */
const SYNC_INTERVAL_MS = 1000;
let lastSyncAt = 0;

/** 縮退中でも一定間隔で復帰を試み、成功したら再開を通知する */
function tryRecoverFileOutput(): void {
  if (!fileOutputDegraded) return;
  if (Date.now() - lastFileRetryAt < FILE_RETRY_INTERVAL_MS) return;
  lastFileRetryAt = Date.now();
  dirReady = false;
  ensureLogDir();
  if (dirReady) {
    fileOutputDegraded = false;
    console.warn(`[agent-core:warn] log file output resumed (${env.logFile})`);
  }
}

function writeFile(level: LogLevel, line: string): void {
  // 縮退中は一定間隔で復帰を試みる (失敗が一時的ならファイルログを再開する)
  if (fileOutputDegraded) tryRecoverFileOutput();
  try {
    // 外部プロセスによる削除/再作成等でカウンタと実サイズが乖離しないよう、
    // 一定間隔ごとに実測へ再同期する (毎行の statSync はホットパスで syscall が増えるため)
    if (Date.now() - lastSyncAt >= SYNC_INTERVAL_MS) {
      lastSyncAt = Date.now();
      syncWrittenBytes();
    }
    if (writtenBytes >= MAX_LOG_SIZE) rotateLog();
    // 回転が継続失敗してハード上限を超えた場合は末尾を残して切り詰める (ディスク枯渇防止)
    if (rotateDegraded && writtenBytes >= MAX_LOG_HARD_LIMIT) truncateLogTail();
    if (!dirReady) ensureLogDir();
    const record = `[${new Date().toISOString()}] [agent-core:${level}] ${line}\n`;
    // 新規作成時も 0600 を明示 (umask に依存しない)
    appendFileSync(env.logFile, record, { encoding: 'utf8', mode: 0o600 });
    writtenBytes += Buffer.byteLength(record);
    fileOutputDegraded = false;
    // 復帰成功時は以降の失敗でも再通知できるよう警告フラグを再アームする (観測性)
    warnedFileError = false;
  } catch (err) {
    // ファイル出力失敗 (権限/ディスク不足等) でプロセスを止めない — コンソール側は継続する。
    // 「クラッシュ原因調査」用ログが機能していないことを一度だけ通知し、以後は復帰待ちになる
    fileOutputDegraded = true;
    if (!warnedFileError) {
      warnedFileError = true;
      console.warn(
        `[agent-core:warn] log file output disabled (${env.logFile}): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

function write(level: LogLevel, ...args: unknown[]): void {
  if (!enabled(level)) return;
  const line = formatLine(args);
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[agent-core:${level}] ${line}`);
  writeFile(level, line);
}

export const log = {
  debug: (...args: unknown[]) => write('debug', ...args),
  info: (...args: unknown[]) => write('info', ...args),
  warn: (...args: unknown[]) => write('warn', ...args),
  error: (...args: unknown[]) => write('error', ...args),
};

/** 循環参照等で JSON.stringify が例外を投げる値を安全に文字列化する (ログ用)。
 *  Error は JSON.stringify が '{}' を返してしまうため、先に name: message へ変換する */
export function safeStringify(value: unknown): string {
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
