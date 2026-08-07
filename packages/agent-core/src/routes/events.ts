/**
 * SSE イベントプロキシ (要件 #1 §2.2, §3.1.4)
 *
 * OpenCode Server のイベントストリームを Frontend へ中継:
 *  - message.updated / message.part.updated (Streaming delta) / session.idle
 *  - permission.updated (承認フロー #2 §7)
 *
 * クライアント切断時は購読を停止する。
 */
import type { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Event, Permission } from '@opencode-ai/sdk';
import { getOpencodeClient } from '../opencode.js';
import { env } from '../env.js';
import { enforcePermission } from './permissions.js';

/** アシスタントメッセージ完了時にトークン使用量を Gatekeeper へ記録 (#27, #1 §3.2.5)
 *  ※ message.updated は同一メッセージで複数回発火し得るため、messageID で冪等化 */
const recordedUsage = new Set<string>();

function recordUsage(
  sessionId: string,
  messageId: string,
  info: { providerID?: string; modelID?: string; tokens?: unknown; cost?: number },
): void {
  if (recordedUsage.has(messageId)) return;
  const tokens = info.tokens as { input?: number; output?: number } | undefined;
  if (!info.modelID || !tokens?.input) return;
  recordedUsage.add(messageId);
  const payload = {
    sessionId,
    provider: info.providerID ?? 'unknown',
    model: info.modelID,
    inputTokens: tokens.input ?? 0,
    outputTokens: tokens.output ?? 0,
    cost: info.cost ?? 0,
  };
  void fetch(`${env.gatekeeperUrl}/api/usage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => {});
}

export function registerEventRoutes(app: Hono): void {
  const api = getOpencodeClient();

  app.get('/api/events', (c) =>
    streamSSE(c, async (stream) => {
      let aborted = false;
      stream.onAbort(() => {
        aborted = true;
      });

      const heartbeat = setInterval(() => {
        if (!aborted) stream.writeSSE({ event: 'ping', data: String(Date.now()) }).catch(() => {});
      }, 15000);

      try {
        const result = await api.event.subscribe();
        for await (const event of result.stream) {
          if (aborted) break;
          let data: unknown = event.properties;

          // 承認フロー: ポリシー判定を実効化し、UI 表示が必要な場合のみ policy 情報を付与 (#2 §7)
          if (event.type === 'permission.updated') {
            const permission = (event as Extract<Event, { type: 'permission.updated' }>).properties;
            const { show, action } = await enforcePermission(permission as Permission);
            data = show
              ? { ...(permission as unknown as Record<string, unknown>), __policy: action }
              : { ...(permission as unknown as Record<string, unknown>), __autoHandled: true };
          } else if (event.type === 'message.updated') {
            // 使用量記録 (#27): アシスタントメッセージの完了時 (tokens 確定) に Gatekeeper へ記録
            const props = (event as Extract<Event, { type: 'message.updated' }>).properties as {
              info?: {
                id?: string;
                role?: string;
                sessionID?: string;
                providerID?: string;
                modelID?: string;
                tokens?: unknown;
                cost?: number;
                time?: { completed?: number };
              };
            };
            const info = props.info ?? {};
            if (info.role === 'assistant' && info.time?.completed && info.id) {
              recordUsage(info.sessionID ?? '', info.id, info);
            }
          }

          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(data),
          });
        }
      } catch {
        if (!aborted) {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ message: 'OpenCode event stream unavailable' }),
          });
        }
      } finally {
        clearInterval(heartbeat);
      }
    }),
  );
}
