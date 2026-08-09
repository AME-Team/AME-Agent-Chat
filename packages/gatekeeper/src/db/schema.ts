/**
 * Gatekeeper SQLite スキーマ (要件 #1 §5, #2 §10)
 *
 * ホスト OS の Gatekeeper API に組み込むローカル永続化。
 * token_usages は Check Usage (#27) 用に定義のみ・非活性 (要件 #1 §3.2.5)。
 */
import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

/** チャットセッション (要件 #2 §10 sessions) */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default(''),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
});

/** 会話履歴 (要件 #2 §10 chat_messages) */
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull().default(''),
  /** 実際に処理を担当したプロバイダー・モデル・推論量 (要件 #2 §4.1) */
  provider: text('provider'),
  model: text('model'),
  reasoningEffort: text('reasoning_effort'),
  createdAt: integer('created_at').notNull(),
  /** メッセージピン留め (要件 #2 §4.4) */
  pinned: integer('pinned', { mode: 'boolean' }).notNull().default(false),
});

/** アプリ設定 (要件 #1 §5 app_settings) */
export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** 承認リクエスト (要件 #2 §7 承認フロー・監査性) */
export const approvalRequests = sqliteTable('approval_requests', {
  /** OpenCode の permissionID と同一 */
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  messageId: text('message_id'),
  permissionId: text('permission_id').notNull(),
  /** 操作種別: read / write / execute / package-install 等 */
  type: text('type').notNull(),
  path: text('path'),
  command: text('command'),
  description: text('description').notNull().default(''),
  /** ポリシー判定結果 (要件 #1 §3.4) */
  policy: text('policy', { enum: ['allow', 'approval', 'deny'] }).notNull(),
  policyReason: text('policy_reason'),
  status: text('status', {
    enum: ['pending', 'approved', 'whitelisted', 'rejected'],
  })
    .notNull()
    .default('pending'),
  createdAt: integer('created_at').notNull(),
  decidedAt: integer('decided_at'),
});

/** トークン使用実績 (要件 #1 §5 token_usages) — #27 Check Usage で活性化
 *  sessionId は任意の文脈情報 (OpenCode セッションと異なるため FK は張らない) */
export const tokenUsages = sqliteTable('token_usages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id'),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  cost: real('cost').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

export type SessionRow = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type MessageRow = typeof chatMessages.$inferSelect;
export type NewMessage = typeof chatMessages.$inferInsert;
