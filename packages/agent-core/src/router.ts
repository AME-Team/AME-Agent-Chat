/**
 * LLM ルーター (要件 #1 §2.3, §3.2)
 *
 * ハイブリッド方式 (§3.2.2):
 *  1. ルールベース判定 (ゼロコスト・ミリ秒) — LOW/HIGH を正規表現で分類
 *  2. 軽量 LLM 判定 — ルールで判定不能 (UNKNOWN) な場合は格安モデルで分類 (将来拡張)
 *  3. フォールバック — 判定エラー時は安全側 (Middle) へ
 *
 * 推論量は §3.2.1 の「ティア別設定」を実効値とする。
 * Effort プリセット (§3.2.3) は選択時にティア別推論量へ適用される (設定画面側)。
 */
import { DEFAULT_TIER_CONFIG, type ModelTier, type TierConfig } from '@ame-agent-chat/shared';
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

/** 保存済みティア設定に残り得る非存在モデル ID を実在 ID へ正規化 (Issue #60)。
 *  デフォルト修正 (qwen-3.7-plus → qwen3.7-plus) は新規にのみ効くため、過去に保存した
 *  設定キー (Gatekeeper の tiers) に残る旧 ID もここで移行する */
const DEPRECATED_MODELS: Record<string, string> = {
  'qwen-3.7-plus': 'qwen3.7-plus',
};

function normalizeModel(id: string): string {
  return DEPRECATED_MODELS[id] ?? id;
}

interface EffectiveSettings {
  tiers: TierConfig;
  compressContext: boolean;
  /** LLM オーケストレーション (#15) の有効フラグ — Issue #62 でデフォルト無効化 */
  enableOrchestration: boolean;
}

/** tiers JSON のスキーマ検証 (不正時はデフォルトへ) */
function parseTiers(raw: string | undefined): TierConfig {
  if (!raw) return DEFAULT_TIER_CONFIG;
  try {
    const parsed = JSON.parse(raw) as Partial<TierConfig>;
    const tiers: Partial<TierConfig> = {};
    for (const key of ['high', 'middle', 'low'] as const) {
      const t = parsed[key];
      if (t && typeof t.provider === 'string' && typeof t.model === 'string') {
        tiers[key] = {
          provider: t.provider,
          model: normalizeModel(t.model),
          reasoningEffort: t.reasoningEffort ?? 'middle',
        };
      }
    }
    if (!tiers.high || !tiers.middle || !tiers.low) return DEFAULT_TIER_CONFIG;
    return tiers as TierConfig;
  } catch {
    return DEFAULT_TIER_CONFIG;
  }
}

// TTL キャッシュ: 設定は稀にしか変化しないため毎メッセージのブロッキング取得を回避 (§3.2.2.1)
let cache: { at: number; settings: EffectiveSettings } | null = null;
const TTL_MS = 30_000;

/** 設定 PUT 時に呼び出し、BFF キャッシュを即座に破棄する (フロント表示とサーバ挙動の乖離防止 — Issue #62) */
export function invalidateSettingsCache(): void {
  cache = null;
}

async function fetchEffectiveSettings(): Promise<EffectiveSettings> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.settings;
  // デフォルト: オーケストレーション OFF / 圧縮 OFF (Issue #62)
  const fallback: EffectiveSettings = {
    tiers: DEFAULT_TIER_CONFIG,
    compressContext: false,
    enableOrchestration: false,
  };
  try {
    // Gatekeeper の /api/settings は任意キーを受け付ける key-value ストア (db/repos/settings.ts)。
    // enableOrchestration / tiers / compressContext はフロント (store/settings.ts) から PUT される。
    const res = await fetch(`${env.gatekeeperUrl}/api/settings`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return fallback;
    const settings = (await res.json()) as Record<string, string>;
    const result: EffectiveSettings = {
      tiers: parseTiers(settings.tiers),
      compressContext: settings.compressContext === 'true',
      enableOrchestration: settings.enableOrchestration === 'true',
    };
    cache = { at: Date.now(), settings: result };
    return result;
  } catch {
    return fallback;
  }
}

export interface RoutedModel {
  tier: ModelTier;
  providerID: string;
  modelID: string;
  /** §3.2.1 のティア別推論量 (プリセット適用後の実効値) */
  reasoningEffort: string;
}

/**
 * タスクを分類し、使用モデル (プロバイダー+モデル+推論量) を解決。
 * オーケストレーション無効時 (デフォルト) は null を返し、モデルを注入しない
 * (フロントの明示選択 or opencode 既定モデルで動作 — Issue #62)。
 */
export async function resolveTaskModel(text: string): Promise<RoutedModel | null> {
  const settings = await fetchEffectiveSettings();
  if (!settings.enableOrchestration) return null;
  const tier = routeTask(text);
  const config = settings.tiers[tier];
  return {
    tier,
    providerID: config.provider,
    modelID: config.model,
    reasoningEffort: config.reasoningEffort,
  };
}

/**
 * プロンプト圧縮 (要件 #1 §3.2.4)
 * 設定が有効な場合、送信前に OpenCode の summarize(/compact) で履歴を圧縮してトークン削減。
 */
export async function shouldCompact(): Promise<boolean> {
  const settings = await fetchEffectiveSettings();
  return settings.compressContext;
}
