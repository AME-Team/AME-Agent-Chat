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
import { enforcePermission } from './permissions.js';

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
