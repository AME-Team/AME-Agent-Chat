/**
 * LLM ルーター (要件 #1 §2.3, §3.2)
 *
 * ハイブリッド方式 (§3.2.2):
 *  1. ルールベース判定 (ゼロコスト・ミリ秒) — LOW/HIGH を正規表現で分類
 *  2. 軽量 LLM 判定 — ルールで判定不能 (UNKNOWN) な場合は格安モデルで分類 (将来拡張)
 *  3. フォールバック — 判定エラー時は安全側 (Middle) へ
 *
 * 判定結果 → ティア選択 → プロバイダー/モデル/推論量を解決し prompt へ注入 (§3.2.1, §3.2.3)。
 */
import {
  DEFAULT_TIER_CONFIG,
  EFFORT_MATRICES,
  type ModelTier,
  type TierConfig,
} from '@ame-agent-chat/shared';
import { env } from './env.js';

const LOW_RE =
  /(grep|rg |search|find |list|ls |cat |head|tail|show|version|--help|help|status|一覧|検索|調べ|確認|環境|状況|どこ|何が|whoami|pwd)/i;
const HIGH_RE =
  /(設計|architecture|architect|デバッグ|debug|refactor|リファクタ|最適化|optimize|複雑|スケール|並列|performance|セキュリティ|セキュア|テスト設計|マイグレーション)/i;

/** ルールベース判定 (ゼロコスト) — §3.2.2.1 */
export function routeTask(text: string): ModelTier {
  if (HIGH_RE.test(text)) return 'high';
  if (LOW_RE.test(text)) return 'low';
  // UNKNOWN → フォールバック (Middle) — §3.2.2.2/3
  return 'middle';
}

interface EffectiveSettings {
  tiers: TierConfig;
  effortPreset: keyof typeof EFFORT_MATRICES;
  compressContext: boolean;
}

/** Gatekeeper の app_settings から実効設定を取得 (未接続時はデフォルトへフォールバック) */
async function fetchEffectiveSettings(): Promise<EffectiveSettings> {
  const fallback: EffectiveSettings = {
    tiers: DEFAULT_TIER_CONFIG,
    effortPreset: 'normal',
    compressContext: false,
  };
  try {
    const res = await fetch(`${env.gatekeeperUrl}/api/settings`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return fallback;
    const settings = (await res.json()) as Record<string, string>;
    const tiers = settings.tiers ? (JSON.parse(settings.tiers) as TierConfig) : fallback.tiers;
    const preset = settings.effortPreset as keyof typeof EFFORT_MATRICES;
    return {
      tiers,
      effortPreset: EFFORT_MATRICES[preset] ? preset : fallback.effortPreset,
      compressContext: settings.compressContext === 'true',
    };
  } catch {
    return fallback;
  }
}

export interface RoutedModel {
  tier: ModelTier;
  providerID: string;
  modelID: string;
  /** Effort プリセット × ティア で決まる推論量 (§3.2.3) */
  reasoningEffort: string;
}

/** タスクを分類し、使用モデル (プロバイダー+モデル+推論量) を解決 */
export async function resolveTaskModel(text: string): Promise<RoutedModel> {
  const settings = await fetchEffectiveSettings();
  const tier = routeTask(text);
  const config = settings.tiers[tier];
  return {
    tier,
    providerID: config.provider,
    modelID: config.model,
    reasoningEffort: EFFORT_MATRICES[settings.effortPreset][tier],
  };
}

/**
 * プロンプト圧縮 (要件 #1 §3.2.4)
 * 設定が有効な場合、OpenCode の /compact 相当で履歴を圧縮してトークン削減。
 * (実際の圧縮は OpenCode session 側で実施し、ここでは有効フラグを返す)
 */
export async function shouldCompact(): Promise<boolean> {
  const settings = await fetchEffectiveSettings();
  return settings.compressContext;
}

export const COMPACT_KEEP_MESSAGES = 20;
