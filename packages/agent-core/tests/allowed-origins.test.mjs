/**
 * allowedOrigins.ts の CORS_ORIGIN 正規化 (Issue #73) を検証する。
 * - カンマ区切り + trim + 空除去で正規化される
 * - corsOriginOption: 明示リストは完全一致リストを返す
 *
 * ※ env.ts はプロセスごとに一度しかロードされないため、このファイル内では
 *   CORS_ORIGIN を固定し、単一設定で検証する。
 * 実行: pnpm --filter @ame-agent-chat/agent-core test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.CORS_ORIGIN = 'http://localhost:51730, https://tunnel.example.com, ';

const { effectiveAllowedOrigins, corsOriginOption } = await import('../src/allowedOrigins.ts');

test('effectiveAllowedOrigins: カンマ区切り・trim・空要素除去で正規化される', () => {
  assert.deepEqual(effectiveAllowedOrigins, [
    'http://localhost:51730',
    'https://tunnel.example.com',
  ]);
});

test('corsOriginOption: 明示リストの場合は完全一致リストを返す', () => {
  const option = corsOriginOption();
  assert.ok(Array.isArray(option), '明示リスト時は配列を返すこと');
  assert.deepEqual(option, ['http://localhost:51730', 'https://tunnel.example.com']);
});
