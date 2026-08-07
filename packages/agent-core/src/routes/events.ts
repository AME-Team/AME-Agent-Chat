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
import { getOpencodeClient } from '../opencode.js';

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
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.properties),
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
