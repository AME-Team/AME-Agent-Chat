/**
 * セッション・メッセージ型 (要件 #1 §5, #2 §2, §4.1, §10)
 */

/** メッセージロール (要件 #2 §4.1) */
export type Role = 'user' | 'assistant' | 'system';

/** 担当モデルのメタ情報 (要件 #2 §4.1) */
export interface ModelMeta {
  provider: string;
  model: string;
  reasoningEffort?: string;
}

/** セッション (要件 #2 §2.3, §10) */
export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
}

/** チャットメッセージ (要件 #2 §4.1, §10) */
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  /** 実際に処理を担当したプロバイダー・モデル・推論量 (要件 #2 §4.1) */
  modelMeta?: ModelMeta;
  createdAt: string;
  /** ストリーミング中フラグ */
  streaming?: boolean;
  /** ピン留め (要件 #2 §4.4) */
  pinned?: boolean;
}

/** セッションの並び替え基準 (要件 #2 §2.3) */
export type SessionSortOrder = 'updated' | 'created' | 'name';
