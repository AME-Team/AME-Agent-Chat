#!/usr/bin/env node
/**
 * AME Agent Chat — ローカル開発ワンコマンド (要件 #1 §4.2 / Issue #47)
 * クロスプラットフォーム対応: Windows / Linux / macOS
 *
 * opencode serve (40960) を自動起動してから、全パッケージの dev を並列起動する。
 * 既に opencode が起動済み (40960 が listen 済み) の場合はスキップする。
 */
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const stateDir = path.join(os.tmpdir(), 'ame-agent-chat');
const pidFile = path.join(stateDir, 'opencode.pid');
const logFile = path.join(stateDir, 'opencode.log');

mkdirSync(stateDir, { recursive: true });

const isPortOpen = (port) =>
  new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port });
    sock.setTimeout(1500);
    sock.once('connect', () => {
      sock.destroy();
      resolve(true);
    });
    sock.once('error', () => resolve(false));
    sock.once('timeout', () => {
      sock.destroy();
      resolve(false);
    });
  });

const waitPort = async (timeoutMs, intervalMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(40960)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
};

const killTree = (pid) => {
  try {
    if (isWin) {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
    }
  } catch {
    // 既に終了済み
  }
};

/** 起動した opencode プロセス (spawn 直後に参照可能にする) */
let opencodeChild = null;

async function startOpencode() {
  if (await isPortOpen(40960)) {
    console.log(
      '[dev] OpenCode Server (http://localhost:40960) は既に起動済みのためスキップします。',
    );
    return null;
  }
  console.log('[dev] OpenCode Server を起動 (http://localhost:40960)...');
  const out = openSync(logFile, 'a');
  const child = spawn('opencode', ['serve', '--port', '40960', '--hostname', '127.0.0.1'], {
    cwd: Root,
    env: process.env,
    shell: true,
    detached: true,
    stdio: ['ignore', out, out],
  });
  opencodeChild = child;
  child.on('error', (err) =>
    console.error(`[dev] エラー: opencode を起動できませんでした (${err.message})`),
  );
  child.unref();
  writeFileSync(pidFile, JSON.stringify({ opencode: child.pid }, null, 2));
  closeSync(out);
  const earlyExit = new Promise((resolve) => {
    child.on('exit', (code) => resolve(code));
  });
  const outcome = await Promise.race([
    waitPort(30000, 1000).then((ok) => ({ ok, exit: null })),
    earlyExit.then((code) => ({ ok: false, exit: code })),
  ]);
  if (outcome.exit !== null) {
    throw new Error(`opencode serve が異常終了しました (code=${outcome.exit})。ログ: ${logFile}`);
  }
  if (!outcome.ok) {
    console.warn(`[dev] 警告: opencode serve が 30 秒以内に起動しませんでした。ログ: ${logFile}`);
  }
  return child;
}

function main() {
  const cleanup = () => {
    if (opencodeChild) killTree(opencodeChild.pid);
    rmSync(pidFile, { force: true });
  };

  const exit = (code) => {
    cleanup();
    process.exit(code);
  };

  process.on('SIGINT', () => exit(130));
  process.on('SIGTERM', () => exit(143));

  startOpencode()
    .then((child) => {
      opencodeChild = child;
      console.log('[dev] 全パッケージを並列起動...');
      const dev = spawn('pnpm', ['-r', '--parallel', 'run', 'dev'], {
        cwd: Root,
        env: process.env,
        shell: true,
        stdio: 'inherit',
      });
      dev.on('error', (err) => {
        console.error(`[dev] エラー: pnpm dev を起動できませんでした (${err.message})`);
        exit(1);
      });
      dev.on('exit', (code) => exit(code ?? 0));
    })
    .catch((err) => {
      console.error(`[dev] エラー: ${err.message}`);
      exit(1);
    });
}

main();
