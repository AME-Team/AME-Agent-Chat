/**
 * メッセージリポジトリ (要件 #2 §4, §10)
 * セッション別一覧・追加・削除・ピン留め。
 */
import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { chatMessages } from '../schema.js';
import type * as schema from '../schema.js';

type Db = BetterSQLite3Database<typeof schema>;
export type MessageRow = typeof chatMessages.$inferSelect;
/** 新規メッセージ入力 (DB 既定値を補完) */
export interface NewMessageInput {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content?: string;
  provider?: string | null;
  model?: string | null;
  reasoningEffort?: string | null;
  id?: string;
  createdAt?: number;
  pinned?: boolean;
}

export function createMessageRepo(db: Db) {
  return {
    async listBySession(sessionId: string): Promise<MessageRow[]> {
      // 会話表示順 (古い順) を保証 — 要件 #2 §4
      return db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
    },

    async get(messageId: string): Promise<MessageRow | undefined> {
      const [row] = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.id, messageId))
        .limit(1);
      return row;
    },

    async add(input: NewMessageInput): Promise<MessageRow> {
      const row = {
        id: input.id ?? crypto.randomUUID(),
        sessionId: input.sessionId,
        role: input.role,
        content: input.content ?? '',
        provider: input.provider,
        model: input.model,
        reasoningEffort: input.reasoningEffort,
        createdAt: input.createdAt ?? Date.now(),
        pinned: input.pinned ?? false,
      };
      await db.insert(chatMessages).values(row);
      return row as MessageRow;
    },

    async setPinned(messageId: string, pinned: boolean): Promise<void> {
      await db.update(chatMessages).set({ pinned }).where(eq(chatMessages.id, messageId));
    },

    async remove(messageId: string): Promise<void> {
      await db.delete(chatMessages).where(eq(chatMessages.id, messageId));
    },
  };
}
