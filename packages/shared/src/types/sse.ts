/**
 * SSE イベント型 (要件 #1 §2.2)
 *
 * OpenCode Server からのイベントストリーム (message.updated / permission.asked / session.idle 等) を
 * Agent Core → Frontend へ中継する。
 */

/** OpenCode 準拠の SSE イベント種別 (要件 #1 §2.2) */
export type SSEEventType =
  | 'message.updated'
  | 'message.completed'
  | 'permission.asked'
  | 'session.idle'
  | 'session.busy'
  | 'tool.started'
  | 'tool.completed'
  | 'error'
  | 'meta';

/** SSE イベントペイロードのベース */
export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  sessionId: string;
  data: T;
  timestamp: string;
}

/** メッセージ更新のペイロード (要件 #1 §2.2 message.updated) */
export interface MessageUpdatedPayload {
  messageId: string;
  role: 'user' | 'assistant' | 'system';
  /** 増分または全体のテキスト */
  delta?: string;
  content?: string;
  modelMeta?: {
    provider: string;
    model: string;
    reasoningEffort?: string;
  };
  finished?: boolean;
}

/** 承認要求のペイロード (要件 #1 §2.2 permission.asked / #2 §7) */
export interface PermissionAskedPayload {
  requestId: string;
  sessionId: string;
  /** 操作対象 */
  path?: string;
  command?: string;
  description: string;
  /** 影響範囲 */
  scope: 'read' | 'write' | 'execute' | 'package-install';
}

/** エラーペイロード */
export interface ErrorPayload {
  message: string;
  code?: string;
}
