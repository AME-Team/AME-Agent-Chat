/**
 * LLM モデルティア・推論量・Effort プリセット (要件 #1 §3.2.1, §3.2.3)
 */

/** 3 層モデルティア (要件 #1 §3.2.1) */
export type ModelTier = 'high' | 'middle' | 'low';

/** 推論量 4 段階 (要件 #1 §3.2.1) */
export type ReasoningEffort = 'high' | 'middle' | 'low' | 'nothing';

/** Effort プリセット 5 段階 (要件 #1 §3.2.3) */
export type EffortPreset = 'deep' | 'smart' | 'normal' | 'lite' | 'rush';

/** ティア別のプロバイダー・モデル・推論量設定 (要件 #1 §3.2.1) */
export interface TierModelConfig {
  provider: string;
  model: string;
  reasoningEffort: ReasoningEffort;
}

/** ティア設定の集合 */
export type TierConfig = Record<ModelTier, TierModelConfig>;

/** Effort プリセットが定義する「ティア × 推論量」のマトリクス (要件 #1 §3.2.3) */
export type EffortMatrix = Record<ModelTier, ReasoningEffort>;

/** Effort プリセット定義テーブル (要件 #1 §3.2.3) */
export const EFFORT_MATRICES: Record<EffortPreset, EffortMatrix> = {
  // Deep: High×High / Middle×Middle / Low×Low
  deep: { high: 'high', middle: 'middle', low: 'low' },
  // Smart: High×High / Middle×High / Low×Low
  smart: { high: 'high', middle: 'high', low: 'low' },
  // Normal: High×Middle / Middle×Middle / Low×Low
  normal: { high: 'middle', middle: 'middle', low: 'low' },
  // Lite: High×Middle / Middle×Low / Low×Low
  lite: { high: 'middle', middle: 'low', low: 'low' },
  // Rush: High×Low / Middle×Low / Low×Low
  rush: { high: 'low', middle: 'low', low: 'low' },
};

/** デフォルトのティア別モデル (要件 #1 §3.2.1) — 全て OpenCode Go。
 *  推論量は Effort Normal マトリクス (High×Middle / Middle×Middle / Low×Low) に整合。
 *  ※ Issue #60: モデル ID は opencode が返す実 ID と一致させる (qwen3.7-plus は
 *    ハイフン無し)。存在しないモデル ID を注入すると opencode が 500 を返す。 */
export const DEFAULT_TIER_CONFIG: TierConfig = {
  high: { provider: 'opencode-go', model: 'glm-5.2', reasoningEffort: 'middle' },
  middle: { provider: 'opencode-go', model: 'qwen3.7-plus', reasoningEffort: 'middle' },
  low: { provider: 'opencode-go', model: 'deepseek-v4-flash', reasoningEffort: 'low' },
};

export const EFFORT_PRESET_LABELS: Record<EffortPreset, string> = {
  deep: 'Deep',
  smart: 'Smart',
  normal: 'Normal',
  lite: 'Lite',
  rush: 'Rush',
};

export const MODEL_TIER_LABELS: Record<ModelTier, string> = {
  high: 'High',
  middle: 'Middle',
  low: 'Low',
};

export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  high: 'High',
  middle: 'Middle',
  low: 'Low',
  nothing: 'Nothing',
};
