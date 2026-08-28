/**
 * エージェントモード (PLAN / BUILD) — Issue #72
 *
 * OpenCode TUI の PLAN / BUILD モード相当。OpenCode SDK の session.prompt body の
 * `agent` フィールドへ渡す値 (既定は build)。
 */

/** エージェントモード (build = 実行・編集可 / plan = 読み取り専用の計画立案) */
export type AgentMode = 'build' | 'plan';

/** エージェントモード一覧 (表示順)。labelKey / descKey は frontend の i18n キー。
 *  モード追加時に id だけでなくラベル・説明キーをここに揃える (三項演算での導出を排除) */
export const AGENT_MODES: readonly { id: AgentMode; labelKey: string; descKey: string }[] = [
  { id: 'build', labelKey: 'mode.build', descKey: 'mode.buildDesc' },
  { id: 'plan', labelKey: 'mode.plan', descKey: 'mode.planDesc' },
];

/** 既定のエージェントモード */
export const DEFAULT_AGENT_MODE: AgentMode = 'build';

/** 不正値などが渡された際に既定へ正規化する */
export function isAgentMode(v: unknown): v is AgentMode {
  return v === 'build' || v === 'plan';
}

/** 文字列を AgentMode へ正規化 (不正値は build) */
export function normalizeAgentMode(v: unknown): AgentMode {
  return isAgentMode(v) ? v : DEFAULT_AGENT_MODE;
}
