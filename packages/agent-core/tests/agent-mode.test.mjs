/**
 * エージェント名の解決 (Issue #72)
 * agent-core の messages ルートが prompt 送信前に利用する resolveAgent の単体検証。
 * 未指定/null は既定 (build)、非文字列・空文字は 400 拒否、カスタムエージェント名はそのまま
 * 許可し、前後空白は trim する契約をここで検証する。
 * (ルート経由の 400 応答・prompt body への agent 反映は本ファイルでは検証しない)
 * 実行: pnpm --filter @ame-agent-chat/agent-core test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveAgent } from '../src/agent.ts';

test('resolveAgent: 未指定・null は既定の build を返す (Issue #72)', () => {
  assert.deepEqual(resolveAgent(undefined), { ok: true, agent: 'build' });
  // null は従来の body.agent ?? 'build' と同じく未指定扱い (後方互換)
  assert.deepEqual(resolveAgent(null), { ok: true, agent: 'build' });
});

test('resolveAgent: build / plan はそのまま通す (Issue #72)', () => {
  assert.deepEqual(resolveAgent('build'), { ok: true, agent: 'build' });
  assert.deepEqual(resolveAgent('plan'), { ok: true, agent: 'plan' });
});

test('resolveAgent: カスタムエージェント名も許可する (Issue #72)', () => {
  assert.deepEqual(resolveAgent('my-custom-agent'), { ok: true, agent: 'my-custom-agent' });
});

test('resolveAgent: 前後空白は trim して渡す (Issue #72)', () => {
  assert.deepEqual(resolveAgent('  plan  '), { ok: true, agent: 'plan' });
  assert.deepEqual(resolveAgent(' build '), { ok: true, agent: 'build' });
  assert.deepEqual(resolveAgent('\tcustom\t'), { ok: true, agent: 'custom' });
});

test('resolveAgent: 空文字・空白のみ・非文字列は 400 拒否 (黙って build 化しない — Issue #72)', () => {
  assert.deepEqual(resolveAgent(''), {
    ok: false,
    error: 'agent must be a non-empty string',
  });
  assert.deepEqual(resolveAgent('   '), {
    ok: false,
    error: 'agent must be a non-empty string',
  });
  assert.deepEqual(resolveAgent(123), {
    ok: false,
    error: 'agent must be a non-empty string',
  });
});
