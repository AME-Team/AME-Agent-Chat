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

/** OpenCode Server への到達性チェック (ヘルスチェック用) */
export async function pingOpencode(): Promise<boolean> {
  try {
    const result = await getOpencodeClient().session.list();
    return !result.error;
  } catch {
    return false;
  }
}
