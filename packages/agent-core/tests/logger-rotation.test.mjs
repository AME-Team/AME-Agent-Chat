/**
 * logger.ts のローテーション (Issue #73) を検証する。
 *
 * LOG_MAX_SIZE を 1024 bytes (env.ts の最小値 1KB 以上) に設定して import し、
 * - 稼働中に writtenBytes が閾値を跨いだ際に .1 へ退避され現行ファイルへ継続追記される
 * - 退避時 (ローテーション) に旧世代の内容が .1 へ正しく保持される
 * ことを確認する。
 *
 * ※ ローテーション判定は logger のモジュール初期化時にファイル実測値で初期化されるため、
 *   このテストは別ファイル (別プロセス) として実行し、import 前に環境変数を固定する。
 * 実行: pnpm --filter @ame-agent-chat/agent-core test
 */
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const dir = mkdtempSync(join(tmpdir(), 'ame-logger-rot-'));
const logFile = join(dir, 'agent-core.log');

// テスト対象ロガーは起動時に環境変数を読むため、import 前に固定する
process.env.LOG_FILE = logFile;
process.env.LOG_LEVEL = 'info';
process.env.LOG_MAX_SIZE = '1024';

const { log } = await import('../src/logger.ts');

test('logger: 稼働中にサイズ上限を跨ぐと .1 へ退避し現行ファイルへ継続追記される', () => {
  // 1 行あたり 560+ bytes。閾値 1024 に対し 2 行目で確実に跨ぐ (タイムスタンプ長に依存しない)
  const payload = 'x'.repeat(560);
  log.info(`first:${payload}`);
  const beforeRotate = readFileSync(logFile, 'utf8');
  assert.ok(beforeRotate.includes('first:'), '1 行目は現行ファイルへ書かれること');

  log.info(`second:${payload}`);
  log.info(`third:${payload}`);

  // ローテーションが 1 回以上発生し、.1 に旧世代 (first) が保持されること
  assert.ok(existsSync(`${logFile}.1`), '.1 世代が作られること');
  const rotated = readFileSync(`${logFile}.1`, 'utf8');
  assert.ok(rotated.includes('first:'), '旧世代の内容が .1 に保持されること');
  // 現行ファイルにはローテーション後の最新行が書かれ続けること
  const current = readFileSync(logFile, 'utf8');
  assert.ok(current.includes('third:'), 'ローテーション後も現行ファイルへ追記されること');
  // 現行ファイルは閾値 (1 行分) を超えない (ローテーション直後は小さく始まる)
  assert.ok(statSync(logFile).size <= 1024, '現行ファイルが過度に肥大しないこと');
});

test.after(() => {
  rmSync(dir, { recursive: true, force: true });
});
