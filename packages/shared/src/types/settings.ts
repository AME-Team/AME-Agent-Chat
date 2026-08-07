/**
 * アプリ設定・デザイン トークン (要件 #1 §5, §3.1.1 / Design_Requirements)
 */

import type { EffortPreset, TierConfig } from './tier.js';

/** 1ポイントカラー 5 プリセット (ame-ui-philosophy §4.2) */
export type AccentColor =
  'trust-blue' | 'stable-green' | 'grounded-orange' | 'sophisticated-indigo' | 'clarity-teal';

/** テーマ (ame-ui-philosophy §4.1) */
export type Theme = 'light' | 'dark' | 'system';

/** フォントセット (ame-ui-typography §4) */
export type FontSet = 'default' | 'serif' | 'user';

/** 対応言語 (ame-ui-philosophy §8.1) */
export type Locale = 'ja' | 'en';

/** 送信方式 (要件 #2 §3.1) */
export type SubmitKey = 'enter' | 'shift-enter';

/** 通知設定 (要件 #2 §9.2) */
export interface NotificationSettings {
  toast: boolean;
  desktop: boolean;
  sound: boolean;
  soundVolume: number;
}

/** アプリ設定 (要件 #1 §5, #2 §9.3) */
export interface AppSettings {
  workspaceRoot: string;
  accentColor: AccentColor;
  theme: Theme;
  fontSet: FontSet;
  locale: Locale;
  submitKey: SubmitKey;
  notifications: NotificationSettings;
  /** Effort プリセット選択 (要件 #1 §3.2.3) */
  effortPreset: EffortPreset;
  /** ティア別プロバイダー・モデル・推論量 (要件 #1 §3.2.1) */
  tiers: TierConfig;
  /** 思考ブロック表示 (要件 #2 §5 /thinking) */
  showThinking: boolean;
}

export const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  toast: true,
  desktop: true,
  sound: true,
  soundVolume: 0.6,
};

export const ACCENT_COLOR_LABELS: Record<AccentColor, string> = {
  'trust-blue': 'Trust Blue',
  'stable-green': 'Stable Green',
  'grounded-orange': 'Grounded Orange',
  'sophisticated-indigo': 'Sophisticated Indigo',
  'clarity-teal': 'Clarity Teal',
};
