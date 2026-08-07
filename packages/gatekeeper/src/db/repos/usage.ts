/**
 * トークン使用実績リポジトリ (要件 #1 §3.2.5 token_usages / #27)
 */
import { desc, sql } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { tokenUsages } from '../schema.js';
import type * as schema from '../schema.js';

type Db = BetterSQLite3Database<typeof schema>;

export interface UsageInput {
  sessionId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export function createUsageRepo(db: Db) {
  return {
    async record(input: UsageInput): Promise<void> {
      await db.insert(tokenUsages).values({
        sessionId: input.sessionId,
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cost: input.cost,
        createdAt: Date.now(),
      });
    },

    /** プロバイダー×モデル別の集計 (トークン・コスト) */
    async aggregate(): Promise<
      Array<{
        provider: string;
        model: string;
        inputTokens: number;
        outputTokens: number;
        cost: number;
      }>
    > {
      return db
        .select({
          provider: tokenUsages.provider,
          model: tokenUsages.model,
          inputTokens: sql<number>`sum(${tokenUsages.inputTokens})`,
          outputTokens: sql<number>`sum(${tokenUsages.outputTokens})`,
          cost: sql<number>`sum(${tokenUsages.cost})`,
        })
        .from(tokenUsages)
        .groupBy(tokenUsages.provider, tokenUsages.model)
        .orderBy(desc(sql`sum(${tokenUsages.cost})`));
    },

    async recent(limit = 50) {
      return db.select().from(tokenUsages).orderBy(desc(tokenUsages.createdAt)).limit(limit);
    },
  };
}
