/**
 * モデル設定ストア (要件 #1 §3.2.1/§3.2.3, #2 §9.3)
 * 3層ティア × プロバイダー/モデル/推論量 + Effort プリセット を Gatekeeper 経由で永続化。
 */
import { create } from 'zustand';
import {
  DEFAULT_TIER_CONFIG,
  EFFORT_MATRICES,
  type EffortPreset,
  type TierConfig,
} from '@ame-agent-chat/shared';
import { api } from '../lib/api';

interface SettingsState {
  tiers: TierConfig;
  effortPreset: EffortPreset;
  compressContext: boolean;
  loaded: boolean;
  /** 読込失敗時は保存を抑止 (デフォルトで実設定を上書きしない) */
  loadError: boolean;
  load: () => Promise<void>;
  setTier: (tier: keyof TierConfig, patch: Partial<TierConfig[keyof TierConfig]>) => void;
  /** Effort プリセット選択 = 各ティアの推論量へマトリクスを適用 (§3.2.3) */
  setEffortPreset: (p: EffortPreset) => void;
  setCompressContext: (v: boolean) => void;
  save: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  tiers: DEFAULT_TIER_CONFIG,
  effortPreset: 'normal',
  compressContext: false,
  loaded: false,
  loadError: false,

  load: async () => {
    try {
      const s = await api.settings.get();
      const tiers = s.tiers ? (JSON.parse(s.tiers) as TierConfig) : DEFAULT_TIER_CONFIG;
      const preset = s.effortPreset as EffortPreset;
      set({
        tiers,
        effortPreset: EFFORT_MATRICES[preset] ? preset : 'normal',
        compressContext: s.compressContext === 'true',
        loaded: true,
        loadError: false,
      });
    } catch {
      set({ loaded: false, loadError: true });
    }
  },

  setTier: (tier, patch) =>
    set((st) => ({ tiers: { ...st.tiers, [tier]: { ...st.tiers[tier], ...patch } } })),
  setEffortPreset: (p) =>
    set((st) => {
      const matrix = EFFORT_MATRICES[p];
      const tiers = { ...st.tiers } as TierConfig;
      (['high', 'middle', 'low'] as const).forEach((tier) => {
        tiers[tier] = { ...tiers[tier], reasoningEffort: matrix[tier] };
      });
      return { effortPreset: p, tiers };
    }),
  setCompressContext: (v) => set({ compressContext: v }),

  save: async () => {
    const { tiers, effortPreset, compressContext } = get();
    await api.settings.put({
      tiers: JSON.stringify(tiers),
      effortPreset,
      compressContext: String(compressContext),
    });
  },
}));
