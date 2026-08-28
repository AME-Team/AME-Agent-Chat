/**
 * エージェント名の解決 (Issue #72)
 *
 * OpenCode は build / plan に加えてカスタム primary エージェントを定義できるため、
 * 未指定は既定 (build) としつつ、非文字列・空文字は黙って build 化せず 400 で明示拒否する
 * (公開 API ポート 30010 経由のカスタムエージェント指定を壊さない — Gate 1 指摘対応)。
 */

export type ResolvedAgent = { ok: true; agent: string } | { ok: false; error: string };

/** body.agent を検証し、OpenCode へ渡すエージェント名へ解決する (前後空白は trim する) */
export function resolveAgent(v: unknown): ResolvedAgent {
  // null は従来の body.agent ?? 'build' と同じく「未指定」として扱う (後方互換 — Gate 1 指摘対応)
  if (v === undefined || v === null) return { ok: true, agent: 'build' };
  if (typeof v !== 'string' || v.trim() === '') {
    return { ok: false, error: 'agent must be a non-empty string' };
  }
  return { ok: true, agent: v.trim() };
}
