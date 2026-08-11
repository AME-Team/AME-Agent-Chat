/**
 * Agent Core 環境設定 (要件 #1 §2.6)
 *
 * OpenCode Server はコンテナ内 localhost:40960 と同居 (要件 #1 §2.4)。
 * ローカル開発時は未起動でもヘルスチェックが graceful に扱う。
 */
import { version } from 'node:process';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const rawLogLevel = (process.env.LOG_LEVEL ?? 'info').toLowerCase();
/** 不正な値は info へフォールバック (暗黙に最も詳細なログへ下がらないようにする) */
const logLevel: LogLevel = (LOG_LEVELS as readonly string[]).includes(rawLogLevel)
  ? (rawLogLevel as LogLevel)
  : 'info';

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
  /** ログレベル (debug | info | warn | error) — 開発モード (`pnpm dev`) は debug (#55) */
  logLevel,
} as const;

export const APP_INFO = {
  name: 'ame-agent-chat/agent-core',
  version: version,
} as const;
