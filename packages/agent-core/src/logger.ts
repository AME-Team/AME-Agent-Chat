/**
 * レベル制御ロガー (Issue #55)
 *
 * `LOG_LEVEL` 環境変数 (debug | info | warn | error) で出力を制御する。
 * 開発モード (`pnpm dev`) は scripts/dev.mjs が LOG_LEVEL=debug を伝播するため、
 * リクエスト詳細や SDK 呼び出しのデバッグログが確認できる。
 */
import { env, LOG_LEVELS, type LogLevel } from './env.js';

const threshold = LOG_LEVELS.indexOf(env.logLevel);

function enabled(level: LogLevel): boolean {
  return LOG_LEVELS.indexOf(level) >= threshold;
}

function write(level: LogLevel, ...args: unknown[]): void {
  if (!enabled(level)) return;
  const line = args
    .map((a) => {
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(`[agent-core:${level}] ${line}`);
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
