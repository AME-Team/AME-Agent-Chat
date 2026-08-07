/**
 * SSE 接続マネージャ (要件 #1 §2.2)
 *
 * /api/events (EventSource) を購読し、OpenCode イベントをストアへ適用。
 * 接続断時は自動再接続 (EventSource の仕様 + バックオフ)。
 */
import { useApp } from '../store/app';

let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connectEvents(): void {
  if (source) return;
  source = new EventSource('/api/events');

  const apply = useApp.getState().applySSE;

  const handle = (type: string) => (ev: MessageEvent) => {
    try {
      apply(type, JSON.parse(ev.data));
    } catch {
      /* ignore malformed */
    }
  };

  for (const type of [
    'message.updated',
    'message.part.updated',
    'session.idle',
    'session.status',
    'permission.updated',
    'session.updated',
    'session.created',
    'session.deleted',
    'error',
  ]) {
    source.addEventListener(type, handle(type) as EventListener);
  }

  source.onerror = () => {
    disconnectEvents();
    reconnectTimer = setTimeout(connectEvents, 3000);
  };
}

export function disconnectEvents(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  source?.close();
  source = null;
}
