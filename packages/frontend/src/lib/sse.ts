/**
 * SSE 接続マネージャ (要件 #1 §2.2)
 *
 * /api/events (EventSource) を購読し、OpenCode イベントをストアへ適用。
 * 接続断時は自動再接続 (EventSource の仕様 + バックオフ)。
 */
import { useApp } from '../store/app';
import { useUI, type PendingPermission } from '../store/ui';

let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export function connectEvents(): void {
  if (source) return;
  source = new EventSource('/api/events');

  const apply = useApp.getState().applySSE;

  const handle = (type: string) => (ev: MessageEvent) => {
    try {
      if (type === 'permission.updated') {
        const p = JSON.parse(ev.data) as PendingPermission & {
          sessionID?: string;
          pattern?: string;
          title?: string;
          __autoHandled?: boolean;
          __policy?: string;
        };
        // ポリシーで自動処理された(allow/deny)イベントはダイアログを出さない (#13)
        if (p.__autoHandled) return;
        useUI.getState().enqueuePermission({
          id: p.id,
          sessionId: p.sessionID ?? p.sessionId,
          type: p.type,
          path: p.path ?? p.pattern,
          command: p.command,
          description: p.description,
          title: p.title,
          policy: p.policy ?? p.__policy,
        });
        return;
      }
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
