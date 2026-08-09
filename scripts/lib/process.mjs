#!/usr/bin/env node
/**
 * AME Agent Chat — スクリプト共通のプロセス管理 (Issue #47)
 * dev.mjs / stop.mjs で共用する opencode プロセスの PID 管理・検証・停止処理。
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const isWin = process.platform === 'win32';
export const stateDir = path.join(os.tmpdir(), 'ame-agent-chat');
export const opencodePidFile = path.join(stateDir, 'opencode.pid');
export const opencodeLogFile = path.join(stateDir, 'opencode.log');

mkdirSync(stateDir, { recursive: true });

export const isPortOpen = (port) =>
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

export const waitPort = async (port, timeoutMs, intervalMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isPortOpen(port)) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
};

/** PID を安全に読み取り。破損時は null (呼び出し側でファイル削除・警告する)。 */
export const readPid = (file) => {
  if (!existsSync(file)) return null;
  try {
    const pid = JSON.parse(readFileSync(file, 'utf8')).opencode;
    return typeof pid === 'number' && Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
};

/** 対象 PID が opencode serve プロセスかを検証する。検証不能環境では true (kill を許可)。 */
export const isOpencodeProcess = (pid) => {
  try {
    if (process.platform === 'linux') {
      const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ');
      return cmdline.includes('opencode') && cmdline.includes('serve');
    }
    if (process.platform === 'darwin') {
      const out = execFileSync('ps', ['-p', String(pid), '-o', 'command='], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      return out.includes('opencode') && out.includes('serve');
    }
    if (process.platform === 'win32') {
      const out = execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
      );
      return out.includes('opencode') && out.includes('serve');
    }
    return true;
  } catch {
    return false;
  }
};

/** プロセスグループごと段階的終了 (SIGTERM → ポーリング待ち → SIGKILL / Windows は taskkill /T /F) */
export const killTree = (pid, timeoutMs = 5000) => {
  const send = (sig) => {
    try {
      if (isWin) {
        spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        process.kill(-pid, sig);
      }
    } catch {
      // 既に終了済み
    }
  };
  if (isWin) {
    send('SIGKILL');
    return;
  }
  send('SIGTERM');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(-pid, 0);
    } catch {
      return;
    }
    const wait = new Int32Array(new SharedArrayBuffer(4));
    Atomics.wait(wait, 0, 0, 200);
  }
  send('SIGKILL');
};
