/**
 * Agent Core 環境設定 (要件 #1 §2.6)
 *
 * OpenCode Server はコンテナ内 localhost:40960 と同居 (要件 #1 §2.4)。
 * ローカル開発時は未起動でもヘルスチェックが graceful に扱う。
 */
import { version } from 'node:process';

export const env = {
  /** Agent Core (BFF) ポート — 要件 #1 §2.6 */
  port: Number(process.env.PORT ?? 30010),
  /** バインド先ホスト (コンテナ公開時は 0.0.0.0) — 要件 #1 §2.6 */
  host: process.env.HOST ?? '0.0.0.0',
  /** OpenCode Server URL (コンテナ内同居) — 要件 #1 §2.2, §2.4 */
  opencodeBaseUrl: process.env.OPENCODE_BASE_URL ?? 'http://localhost:40960',
  /** Frontend (PWA) — CORS 許可オリジン — 要件 #1 §2.6 */
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:51730',
  /** Gatekeeper API (ホスト) — 要件 #1 §2.6 (Phase1 後続) */
  gatekeeperUrl: process.env.GATEKEEPER_URL ?? 'http://localhost:87880',
} as const;

export const APP_INFO = {
  name: 'ame-agent-chat/agent-core',
  version: version,
} as const;
