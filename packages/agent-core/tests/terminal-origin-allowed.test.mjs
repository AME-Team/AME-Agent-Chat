/**
 * terminal.ts の isOriginAllowed の混在時挙動 (Issue #73) を検証する。
 * - `*` と明示エントリ混在時は明示エントリを許可し、それ以外のリモート Origin を拒否する
 *   (旧実装では全拒否だった仕様変更: フェイルクローズで明示エントリのみ有効化)
 *
 * ※ env.ts はプロセスごとに一度しかロードされないため、このファイルは別プロセスとして
 *   実行し、CORS_ORIGIN を '*' 混在に固定する。
 * 実行: pnpm --filter @ame-agent-chat/agent-core test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.CORS_ORIGIN = 'http://localhost:51730,https://tunnel.example.com,*';

const { isOriginAllowed } = await import('../src/routes/terminal.js');

test('isOriginAllowed: 混在時に明示エントリは許可される', () => {
  assert.equal(isOriginAllowed('https://tunnel.example.com'), true, '明示エントリは許可されること');
});

test('isOriginAllowed: 混在時に未設定のリモート Origin は拒否される', () => {
  assert.equal(isOriginAllowed('https://evil.com'), false, '未設定 Origin は拒否されること');
});

test('isOriginAllowed: ループバックは引き続き許可される', () => {
  assert.equal(isOriginAllowed('http://localhost:51730'), true, 'ループバックは許可されること');
});

test('isOriginAllowed: Origin 無しは拒否される', () => {
  assert.equal(isOriginAllowed(undefined), false, 'Origin 無しは拒否されること');
});
