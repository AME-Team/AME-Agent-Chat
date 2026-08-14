/**
 * Agent Core 環境設定 (要件 #1 §2.6)
 *
 * OpenCode Server はコンテナ内 localhost:40960 と同居 (要件 #1 §2.4)。
 * ローカル開発時は未起動でもヘルスチェックが graceful に扱う。
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { version } from 'node:process';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const rawLogLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
/** 不正な値は info へフォールバック (暗黙に最も詳細なログへ下がらないようにする) */
const logLevel: LogLevel = (LOG_LEVELS as readonly string[]).includes(rawLogLevel)
  ? (rawLogLevel as LogLevel)
  : 'info';

/** ログファイルのローテーション閾値 (bytes)。不正値・過小値 (1KB 未満) は既定 (1MB) にフォールバック */
const LOG_MAX_SIZE_MIN = 1024;
const rawLogMaxSize = Number(process.env.LOG_MAX_SIZE ?? 1024 * 1024);
const logMaxSize =
  Number.isFinite(rawLogMaxSize) && rawLogMaxSize >= LOG_MAX_SIZE_MIN ? rawLogMaxSize : 1024 * 1024;

/** ログダウンロード API を無効化する値 (これ以外は有効として扱う)。無効値: false/0/no/off */
const LOG_API_DISABLED_VALUES = new Set(['false', '0', 'no', 'off']);

export const env = {
  /** Agent Core (BFF) ポート — 要件 #1 §2.6 */
  port: Number(process.env.PORT ?? 30010),
  /** バインド先ホスト (コンテナ公開時は 0.0.0.0) — 要件 #1 §2.6 */
  host: process.env.HOST ?? '0.0.0.0',
  /** OpenCode Server URL (コンテナ内同居) — 要件 #1 §2.2, §2.4 */
  opencodeBaseUrl: process.env.OPENCODE_BASE_URL ?? 'http://localhost:40960',
  /** Frontend (PWA) — CORS 許可オリジン — 要件 #1 §2.6 */
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:51730',
  /** Gatekeeper API (ホスト) — 要件 #1 §2.6 (Phase1 後続)
   *  ※ 要件表の 87880 は TCP 上限超過のため実運用は 58780 */
  gatekeeperUrl: process.env.GATEKEEPER_URL ?? 'http://localhost:58780',
  /** ターミナル API の共有トークン (Issue #65)。未指定時は起動毎にランダム生成され、
   *  フロントは /api/terminal/token から取得して exec 時にヘッダで提示する。
   *  デフォルト空文字の場合はランタイムで randomUUID を生成して利用する */
  terminalToken: process.env.TERMINAL_TOKEN ?? '',
  /** ログレベル (debug | info | warn | error) — 開発モード (`pnpm dev`) は debug (#55) */
  logLevel,
  /** ログファイルのローテーション閾値 (bytes)。既定 1MB (Issue #73) */
  logMaxSize,
  /** ログファイル出力先 (Issue #73)。既定は OS の一時ディレクトリ配下の agent-core.log */
  logFile: process.env.LOG_FILE ?? join(tmpdir(), 'ame-agent-chat', 'agent-core.log'),
  /** ログ API (/api/logs) の公開スイッチ (Issue #73)。
   *  ログにはリクエスト詳細や SDK 呼び出し内容が含まれ得る。
   *  既定では有効だが、ダウンロード API はターミナル API と同じ共有トークン
   *  (未設定時は起動毎ランダム) + Origin 検証で保護されており、LAN 上の任意ホストから
   *  は取得できない。本番等の不要な環境では LOG_API_ENABLED=false で無効化できる。
   *  'false' | '0' | 'no' | 'off' のいずれかで無効化 (それ以外は有効) */
  logApiEnabled: !LOG_API_DISABLED_VALUES.has(
    (process.env.LOG_API_ENABLED ?? 'true').toLowerCase(),
  ),
} as const;

export const APP_INFO = {
  name: 'ame-agent-chat/agent-core',
  version: version,
} as const;
