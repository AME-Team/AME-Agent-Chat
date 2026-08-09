#!/usr/bin/env node
/**
 * AME Agent Chat — ワンコマンド自動起動 (要件 #1 §4.2)
 * クロスプラットフォーム対応: Windows / Linux / macOS
 *
 * Docker 確認 → Gatekeeper(ホスト) 起動 → Frontend 起動 → compose up → ヘルスチェック → ブラウザ表示
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const stateDir = path.join(os.tmpdir(), 'ame-agent-chat');
const pidFile = path.join(stateDir, 'pids.json');
const logFile = (name) => path.join(stateDir, `${name}.log`);

mkdirSync(stateDir, { recursive: true });

const step = (n, msg) => console.log(`[${n}/5] ${msg}`);
const dockerReady = () => spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
const waitFor = async (fn, timeoutMs, intervalMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
};

const children = [];
const onSpawnError = (name) => (err) =>
  console.error(`エラー: ${name} を起動できませんでした (${err.message})`);

const startDockerDesktop = () => {
  console.log('Docker を起動中...');
  if (isMac) {
    spawn('open', ['-a', 'Docker'], { stdio: 'ignore' }).on(
      'error',
      onSpawnError('Docker Desktop'),
    );
  } else if (isWin) {
    spawn('cmd.exe', ['/c', 'start', '', 'docker desktop'], { stdio: 'ignore' }).on(
      'error',
      onSpawnError('Docker Desktop'),
    );
  }
};

const openBrowser = (url) => {
  const cmd = isMac
    ? ['open', [url]]
    : isWin
      ? ['cmd.exe', ['/c', 'start', '', url]]
      : ['xdg-open', [url]];
  spawn(cmd[0], cmd[1], { stdio: 'ignore' }).on('error', () =>
    console.log(`ブラウザを自動で開けませんでした。${url} を手動で開いてください。`),
  );
};

const spawnService = (name, args) => {
  const out = openSync(logFile(name), 'a');
  const child = spawn('pnpm', args, {
    cwd: Root,
    env: process.env,
    shell: true,
    detached: true,
    stdio: ['ignore', out, out],
  });
  child.on('error', onSpawnError(name));
  child.unref();
  children.push(child);
  return child;
};

const savePids = () =>
  writeFileSync(
    pidFile,
    JSON.stringify({ gatekeeper: children[0]?.pid, frontend: children[1]?.pid }, null, 2),
  );

const cleanup = () => {
  for (const child of children) {
    try {
      if (isWin) {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        process.kill(-child.pid, 'SIGTERM');
      }
    } catch {
      // 既に終了済み
    }
  }
  rmSync(pidFile, { force: true });
};

async function main() {
  step(1, 'Docker を確認...');
  if (!dockerReady()) {
    if (isWin || isMac) {
      startDockerDesktop();
      if (!(await waitFor(dockerReady, 120000, 2000))) {
        throw new Error('Docker が起動しませんでした。Docker Desktop を手動で起動してください。');
      }
    } else {
      throw new Error(
        'Docker が起動していません。`sudo systemctl start docker` 等で起動してください。',
      );
    }
  }

  step(2, 'Gatekeeper API を起動 (ホスト)...');
  spawnService('gatekeeper', ['--filter', '@ame-agent-chat/gatekeeper', 'start']);

  step(3, 'Frontend (PWA) を起動...');
  spawnService('frontend', ['--filter', '@ame-agent-chat/frontend', 'dev']);

  savePids();

  try {
    step(4, 'Agent コンテナを起動...');
    process.env.WORKSPACE_DIR = Root;
    const compose = spawnSync(
      'docker',
      ['compose', '-f', 'docker-compose.yml', 'up', '-d', '--build'],
      { cwd: Root, env: process.env, stdio: 'inherit' },
    );
    if (compose.status !== 0) throw new Error('docker compose up に失敗しました。');

    step(5, 'ヘルスチェック...');
    const healthy = await waitFor(
      async () => {
        try {
          const res = await fetch('http://localhost:30010/health', {
            signal: AbortSignal.timeout(3000),
          });
          return res.ok;
        } catch {
          return false;
        }
      },
      120000,
      2000,
    );
    if (!healthy)
      throw new Error(
        'Agent Core のヘルスチェックがタイムアウトしました。ログを確認してください。',
      );
  } catch (err) {
    cleanup();
    throw err;
  }

  console.log('起動完了。ブラウザで Frontend を開きます。');
  console.log(`  Frontend  : http://localhost:51730  (ログ: ${logFile('frontend')})`);
  console.log(`  Gatekeeper: ログ: ${logFile('gatekeeper')}`);
  openBrowser('http://localhost:51730');
}

main().catch((err) => {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
});
