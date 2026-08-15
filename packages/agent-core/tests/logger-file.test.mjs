/**
 * logger.ts のファイル出力 (Issue #73) を検証する。
 *
 * - コンソールに加えて LOG_FILE へ ISO タイムスタンプ付きで追記される
 * - LOG_LEVEL=info では debug が書かれず、info 以上が書かれる (閾値制御)
 *
 * ※ env.ts はプロセスごとに一度しかロードされないため、このファイル内では
 *   LOG_FILE / LOG_LEVEL を固定し、単一設定で検証する。
 *   ローテーションは logger-rotation.test.mjs (別プロセス) で検証する。
 * 実行: pnpm --filter @ame-agent-chat/agent-core test
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const dir = mkdtempSync(join(tmpdir(), 'ame-logger-'));
const logFile = join(dir, 'agent-core.log');

// テスト対象ロガーは起動時に環境変数を読むため、import 前に固定する
process.env.LOG_FILE = logFile;
process.env.LOG_LEVEL = 'info';

const { log } = await import('../src/logger.ts');

test('logger: LOG_FILE へタイムスタンプ付きで追記される', () => {
  log.info('hello', { a: 1 });
  log.error('boom');
  assert.ok(existsSync(logFile), 'ログファイルが作成されること');
  const content = readFileSync(logFile, 'utf8');
  assert.match(content, /\[agent-core:info\] hello/);
  assert.match(content, /\[agent-core:error\] boom/);
  // ISO タイムスタンプ形式のプレフィクスが付くこと
  assert.match(content, /\[\d{4}-\d{2}-\d{2}T/);
});

test('logger: LOG_LEVEL=info では debug が書かれず info 以上が書かれる', () => {
  log.debug('hidden');
  log.info('shown');
  const content = readFileSync(logFile, 'utf8');
  assert.ok(!content.includes('hidden'), 'info レベルでは debug が書かれないこと');
  assert.ok(content.includes('shown'), 'info レベルは書かれること');
});

test.after(() => {
  rmSync(dir, { recursive: true, force: true });
});
