/**
 * セッションリポジトリ (要件 #2 §2)
 * CRUD・ピン留め・並び替え・タイトル+メッセージ内容の検索 (#2 §2.3)。
 */
import { eq, like, or, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sessions, type NewSession } from '../schema.js';
import type * as schema from '../schema.js';

type Db = BetterSQLite3Database<typeof schema>;
export type SessionRow = typeof sessions.$inferSelect;
export type SessionSort = 'updated' | 'created' | 'name';
/** 新規セッション入力 (DB 既定値を補完) */
export interface NewSessionInput {
  id?: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  pinned?: boolean;
}

export function createSessionRepo(db: Db) {
  return {
    /** 一覧 (並び替え + タイトル/メッセージ内容の検索) — 要件 #2 §2.3 */
    async list(sort: SessionSort = 'updated', query = ''): Promise<SessionRow[]> {
      const q = query.trim();
      const where = q
        ? or(
            like(sessions.title, `%${q}%`),
            sql`${sessions.id} IN (SELECT DISTINCT session_id FROM chat_messages WHERE content LIKE ${`%${q}%`})`,
          )
        : undefined;
      const rows = await db.select().from(sessions).where(where);
      return sortRows(rows, sort);
    },

    async get(id: string): Promise<SessionRow | undefined> {
      const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      return row;
    },

    async create(input: NewSessionInput): Promise<SessionRow> {
      const now = Date.now();
      const row: NewSession = {
        id: input.id ?? crypto.randomUUID(),
        title: input.title ?? '',
        createdAt: input.createdAt ?? now,
        updatedAt: input.updatedAt ?? now,
        pinned: input.pinned ?? false,
      };
      await db.insert(sessions).values(row);
      return row as SessionRow;
    },

    async update(
      id: string,
      patch: { title?: string; pinned?: boolean },
    ): Promise<SessionRow | undefined> {
      await db
        .update(sessions)
        .set({ ...patch, updatedAt: Date.now() })
        .where(eq(sessions.id, id));
      return this.get(id);
    },

    async remove(id: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.id, id));
    },
  };
}

function sortRows(rows: SessionRow[], sort: SessionSort): SessionRow[] {
  const copy = [...rows];
  if (sort === 'created') copy.sort((a, b) => a.createdAt - b.createdAt);
  else if (sort === 'name') copy.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  else copy.sort((a, b) => b.updatedAt - a.updatedAt);
  return copy;
}
