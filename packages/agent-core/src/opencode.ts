/**
 * OpenCode SDK クライアント (要件 #1 §2.2)
 *
 * `opencode serve` (40960) へ @opencode-ai/sdk で接続。
 */
import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk';
import { env } from './env.js';
import { log } from './logger.js';

let client: OpencodeClient | null = null;

/** OpenCode SDK クライアントを取得 (遅延生成) */
export function getOpencodeClient(): OpencodeClient {
  if (!client) {
    client = createOpencodeClient({ baseUrl: env.opencodeBaseUrl });
  }
  return client;
}

/** OpenCode SDK 呼び出しの結果型 (接続不可時は unreachable を立てる) */
export interface OpencodeResult<T> {
  data?: T;
  error?: unknown;
  unreachable?: boolean;
  /** 接続断と判定した根拠 (エラーコード / メッセージ)。ログ検証・単体テストに利用 */
  reason?: string;
}

/** 接続断 (fetch/ネットワーク起因) を示すエラーコードの先頭パターン */
const CONNECTION_CODE_RE = /^(E(CONN|ADDR|NET|HOST|NOTFOUND|AI_)|ETIMEDOUT|EPIPE)/;

/** 接続断と判定した根拠を返す。接続断でなければ undefined */
function connectionErrorReason(cause: unknown): string | undefined {
  if (!(cause instanceof Error)) return undefined;
  const code = (cause as Error & { code?: string }).code ?? '';
  const inner = (cause as { cause?: unknown }).cause;
  const innerCode = inner instanceof Error ? ((inner as Error & { code?: string }).code ?? '') : '';
  if (code && CONNECTION_CODE_RE.test(code)) return code;
  if (innerCode && CONNECTION_CODE_RE.test(innerCode)) return innerCode;
  if (cause.message.includes('fetch failed')) return cause.message;
  return undefined;
}

/** 接続断 (fetch/ネットワーク起因) の判定 — SDK は接続失敗時に TypeError: fetch failed を投げる */
export function isConnectionError(cause: unknown): boolean {
  return connectionErrorReason(cause) !== undefined;
}

/**
 * OpenCode SDK 呼び出しを実行し、接続エラー (Server 未起動など) を { error } に正規化。
 * 接続断のみ unreachable=true として 503 判定に使い、それ以外は原因を隠蔽せず再スローする
 * (グローバル onError が 500 を返し、ログに詳細が残る)。
 */
export async function callOpencode<T>(
  fn: () => Promise<{ data?: T; error?: unknown }>,
): Promise<OpencodeResult<T>> {
  try {
    const result = await fn();
    log.debug('opencode sdk ok');
    return result;
  } catch (cause) {
    const reason = connectionErrorReason(cause);
    log.debug('opencode sdk error', String(cause));
    if (!reason) throw cause;
    return {
      error: { message: 'opencode server unreachable', cause: String(cause) },
      unreachable: true,
      reason,
    };
  }
}

/** OpenCode Server への到達性チェック (ヘルスチェック用) */
export async function pingOpencode(): Promise<boolean> {
  try {
    const result = await callOpencode(() => getOpencodeClient().session.list());
    return !result.error;
  } catch {
    // 接続断以外の例外 (実エラー) も含め到達不可として扱う
    return false;
  }
}
