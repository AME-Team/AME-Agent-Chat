/**
 * allowedOrigins.ts のワイルドカード挙動 (Issue #73) を検証する。
 * - 単独 '*' で全オリジン許可 (identity 関数)
 * - '*' と明示エントリ混在時はフェイルクローズ: '*' を無視し明示エントリのみ有効
 *
 * ※ env.ts はプロセスごとに一度しかロードされないため、このファイルは別プロセスとして
 *   実行し、CORS_ORIGIN を '*' 混在に固定する。
 * 実行: pnpm --filter @ame-agent-chat/agent-core test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.CORS_ORIGIN = 'http://localhost:51730,*';

const { corsOriginOption, effectiveAllowedOrigins } = await import('../src/allowedOrigins.ts');

test('corsOriginOption: * と明示エントリ混在時は明示リストを返す (フェイルクローズ)', () => {
  const option = corsOriginOption();
  assert.ok(Array.isArray(option), '混在時は関数ではなく配列を返すこと');
  assert.deepEqual(option, ['http://localhost:51730'], '混在時は明示エントリのみ有効になること');
});

test('effectiveAllowedOrigins: 混在時に * を除外して明示エントリのみ返す', () => {
  assert.deepEqual(effectiveAllowedOrigins, ['http://localhost:51730']);
});
