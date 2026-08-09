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

/**
 * OpenCode SDK 呼び出しを実行し、接続エラー (Server 未起動など) を { error } に正規化。
 * SDK は fetch 失敗時に例外を投げるため、ルート毎の try/catch を廃して一元化する。
 */
export async function callOpencode<T>(
  fn: () => Promise<{ data?: T; error?: unknown }>,
): Promise<OpencodeResult<T>> {
  try {
    return await fn();
  } catch (cause) {
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
