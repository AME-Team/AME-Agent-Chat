/**
 * OpenCode SDK クライアント (要件 #1 §2.2)
 *
 * `opencode serve` (40960) へ @opencode-ai/sdk で接続。
 */
import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk';
import { env } from './env.js';

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
}

/** 接続断 (fetch/ネットワーク起因) の判定 — SDK は接続失敗時に TypeError: fetch failed を投げる */
function isConnectionError(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;
  const code = (cause as Error & { code?: string }).code ?? '';
  const inner = (cause as { cause?: unknown }).cause;
  const innerCode = inner instanceof Error ? ((inner as Error & { code?: string }).code ?? '') : '';
  const CONNECTION_CODES = [
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENOTFOUND',
    'EAI_AGAIN',
    'ETIMEDOUT',
  ];
  return (
    CONNECTION_CODES.includes(code) ||
    CONNECTION_CODES.includes(innerCode) ||
    cause.message.includes('fetch failed')
  );
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
    return await fn();
  } catch (cause) {
    if (!isConnectionError(cause)) throw cause;
    return {
      error: { message: 'opencode server unreachable', cause: String(cause) },
      unreachable: true,
    };
  }
}

/** OpenCode Server への到達性チェック (ヘルスチェック用) */
export async function pingOpencode(): Promise<boolean> {
  try {
    const result = await getOpencodeClient().session.list();
    return !result.error;
  } catch {
    return false;
  }
}
