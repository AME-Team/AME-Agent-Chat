/**
 * SSE 接続マネージャ (要件 #1 §2.2)
 *
 * /api/events (EventSource) を購読し、OpenCode イベントをストアへ適用。
 * 接続断時は自動再接続 (EventSource の仕様 + バックオフ)。
 */
import { useApp } from '../store/app';
import { useUI, type PendingPermission } from '../store/ui';
import { notifyCompletion } from './notify';
import { tr } from './i18n';
import { PATH_BASED_TYPES } from '@ame-agent-chat/shared';

let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
/** 最終受信時刻。Vite プロキシはバックエンド切断時に接続を閉じないため、
 *  EventSource の onerror が発火せず「死んだ接続」を検知できないことがある
 *  (agent-core 再起動時など)。ハートビート (ping 15s) の停滞で自己回復する。 */
let lastActivity = 0;
let watchdogTimer: ReturnType<typeof setInterval> | null = null;
/** 何も受信しなければ再接続する閾値 (ping 間隔 15s × 3 + 余裕) */
const WATCHDOG_STALE_MS = 45_000;

export function connectEvents(): void {
  if (source) return;
  lastActivity = Date.now();
  source = new EventSource('/api/events');

  const apply = useApp.getState().applySSE;

  const handle = (type: string) => (ev: MessageEvent) => {
    lastActivity = Date.now();
    // ping は生存判定専用: 状態更新 (apply) に流さない
    if (type === 'ping') return;
    try {
      if (type === 'permission.updated') {
        const p = JSON.parse(ev.data) as PendingPermission & {
          sessionID?: string;
          pattern?: string | string[];
          title?: string;
          __autoHandled?: boolean;
          __policy?: string;
          metadata?: { command?: string; filepath?: string };
        };
        // ポリシーで自動処理された(allow/deny)イベントはダイアログを出さない (#13)
        if (p.__autoHandled) return;
        // 承認要求は非フォーカス時に通知 (#2 §9.2)
        notifyCompletion(tr('notify.approvalRequired'));
        // パス種別はパスを表示し、bash 等の非パス種別はコマンドを表示する (重複表示を避ける)
        const isPathType = PATH_BASED_TYPES.has(p.type);
        const joinPattern = (v: string | string[] | undefined) =>
          Array.isArray(v) ? v.join(' ') : v;
        useUI.getState().enqueuePermission({
          id: p.id,
          sessionId: p.sessionID ?? p.sessionId,
          type: p.type,
          path: isPathType ? joinPattern(p.path ?? p.pattern) : undefined,
          // コマンドは metadata.command に入る。bash 等の非パス種別で欠落時のみ
          // pattern (コマンド文字列) へフォールバックし、ファイル操作では命令を表示しない
          command: p.command ?? p.metadata?.command ?? (isPathType ? '' : joinPattern(p.pattern)),
          description: p.description,
          title: p.title,
          policy: p.policy ?? p.__policy,
        });
        return;
      }
      if (type === 'session.idle') {
        notifyCompletion(tr('notify.sessionComplete'));
      }
      apply(type, JSON.parse(ev.data));
    } catch {
      /* ignore malformed */
    }
  };

  // 'ping' は agent-core が 15 秒毎に送るキープアライブ (data: タイムスタンプ)。
  // 受信時刻を lastActivity へ反映してウォッチドッグの生存判定に使う
  for (const type of [
    'message.updated',
    'message.part.updated',
    'session.idle',
    'session.status',
    'permission.updated',
    'session.updated',
    'session.created',
    'session.deleted',
    'ping',
    'error',
  ]) {
    source.addEventListener(type, handle(type) as EventListener);
  }

  source.onerror = () => {
    disconnectEvents();
    reconnectTimer = setTimeout(connectEvents, 3000);
  };

  // 死んだ接続の検知: 一定時間イベント (ping 含む) が届かなければ再接続する
  if (watchdogTimer) clearInterval(watchdogTimer);
  watchdogTimer = setInterval(() => {
    if (source && Date.now() - lastActivity > WATCHDOG_STALE_MS) {
      disconnectEvents();
      reconnectTimer = setTimeout(connectEvents, 3000);
    }
  }, 10_000);
}

export function disconnectEvents(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  source?.close();
  source = null;
}
