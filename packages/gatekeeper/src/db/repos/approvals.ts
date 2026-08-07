/**
 * 承認リクエストリポジトリ (要件 #2 §7.2 履歴・監査性)
 */
import { desc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { approvalRequests } from '../schema.js';
import type * as schema from '../schema.js';

type Db = BetterSQLite3Database<typeof schema>;
export type ApprovalRow = typeof approvalRequests.$inferSelect;
export type ApprovalStatus = ApprovalRow['status'];
export type ApprovalPolicy = 'allow' | 'approval' | 'deny';

export interface ApprovalInput {
  id: string;
  sessionId: string;
  messageId?: string;
  permissionId: string;
  type: string;
  path?: string;
  command?: string;
  description?: string;
  policy: ApprovalPolicy;
  policyReason?: string;
}

export function createApprovalRepo(db: Db) {
  return {
    async create(input: ApprovalInput): Promise<ApprovalRow> {
      await db
        .insert(approvalRequests)
        .values({
          id: input.id,
          sessionId: input.sessionId,
          messageId: input.messageId,
          permissionId: input.permissionId,
          type: input.type,
          path: input.path,
          command: input.command,
          description: input.description ?? '',
          policy: input.policy,
          policyReason: input.policyReason,
          status: 'pending',
          createdAt: Date.now(),
          decidedAt: null,
        })
        .onConflictDoUpdate({
          target: approvalRequests.id,
          set: {
            type: input.type,
            path: input.path,
            command: input.command,
            description: input.description ?? '',
          },
        });
      // GET と同一スキーマ (snake_case) の行を返す
      const row = await this.get(input.id);
      if (!row) throw new Error('approval insert failed');
      return row;
    },

    async listByStatus(status?: ApprovalStatus): Promise<ApprovalRow[]> {
      const q = db.select().from(approvalRequests);
      return status ? q.where(eq(approvalRequests.status, status)) : q;
    },

    async history(limit = 50): Promise<ApprovalRow[]> {
      return db
        .select()
        .from(approvalRequests)
        .orderBy(desc(approvalRequests.createdAt))
        .limit(limit);
    },

    async get(id: string): Promise<ApprovalRow | undefined> {
      const [row] = await db
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.id, id))
        .limit(1);
      return row;
    },

    async decide(id: string, status: 'approved' | 'whitelisted' | 'rejected'): Promise<void> {
      await db
        .update(approvalRequests)
        .set({ status, decidedAt: Date.now() })
        .where(eq(approvalRequests.id, id));
    },
  };
}
