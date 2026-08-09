#!/usr/bin/env node
/**
 * AME Agent Chat — ワンコマンド停止
 * クロスプラットフォーム対応: Windows / Linux / macOS
 *
 * Agent コンテナ停止 → Gatekeeper / Frontend プロセス終了
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const stateDir = path.join(os.tmpdir(), 'ame-agent-chat');
const pidFile = path.join(stateDir, 'pids.json');

const killTree = (pid) => {
  try {
    if (isWin) {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // 既に終了済み
    }
  }
};

console.log('Agent コンテナを停止...');
const down = spawnSync('docker', ['compose', '-f', 'docker-compose.yml', 'down'], {
  cwd: Root,
  stdio: 'inherit',
});
if (down.status !== 0) {
  console.warn('警告: docker compose down に失敗しました。コンテナが残っている場合があります。');
}

console.log('Gatekeeper / Frontend プロセスを終了...');
if (existsSync(pidFile)) {
  const { gatekeeper, frontend } = JSON.parse(readFileSync(pidFile, 'utf8'));
  for (const pid of [gatekeeper, frontend]) {
    if (pid) killTree(pid);
  }
  rmSync(pidFile, { force: true });
} else {
  console.log('PID ファイルが見つかりません。手動でプロセスを終了してください。');
}

console.log('停止しました。');
