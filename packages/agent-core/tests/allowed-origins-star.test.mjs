/**
 * allowedOrigins.ts の単独 `*` (全オリジン許可) 挙動 (Issue #73) を検証する。
 * - corsOriginOption が identity 関数を返し、任意の Origin を許可する
 * - effectiveAllowedOrigins は空 (明示エントリなし)
 *
 * ※ env.ts はプロセスごとに一度しかロードされないため、このファイルは別プロセスとして
 *   実行し、CORS_ORIGIN を単独 '*' に固定する。
 * 実行: pnpm --filter @ame-agent-chat/agent-core test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.CORS_ORIGIN = '*';

const { effectiveAllowedOrigins, corsOriginOption } = await import('../src/allowedOrigins.ts');

test('corsOriginOption: 単独 * は identity 関数 (全オリジン許可) を返す', () => {
  const option = corsOriginOption();
  assert.equal(typeof option, 'function', '単独 * 時は関数を返すこと');
  const fn = option;
  assert.equal(fn('https://evil.example'), 'https://evil.example', '任意の Origin を許可すること');
});

test('effectiveAllowedOrigins: 単独 * では明示エントリが空になる', () => {
  assert.deepEqual(effectiveAllowedOrigins, [], '単独 * 時は明示リストが空であること');
});
