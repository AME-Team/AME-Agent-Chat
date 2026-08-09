#!/usr/bin/env node
/**
 * AME Agent Chat — ローカル開発ワンコマンド (要件 #1 §4.2 / Issue #47)
 * クロスプラットフォーム対応: Windows / Linux / macOS
 *
 * opencode serve (40960) を自動起動してから、全パッケージの dev を並列起動する。
 * 既に opencode が起動済み (40960 が listen 済み) の場合はスキップする。
 */
import { spawn } from 'node:child_process';
import { openSync, writeFileSync, closeSync, rmSync } from 'node:fs';
import {
  Root,
  opencodeLogFile,
  opencodePidFile,
  isPortOpen,
  waitPort,
  killTree,
  isOpencodeProcess,
  readPid,
} from './lib/process.mjs';

/** 起動した opencode プロセス (spawn 直後に参照可能にする) */
let opencodeChild = null;

async function startOpencode() {
  if (await isPortOpen(40960)) {
    console.log(
      '[dev] OpenCode Server (http://localhost:40960) は既に起動済みのためスキップします。',
    );
    reconcileStalePid();
    return null;
  }
  console.log('[dev] OpenCode Server を起動 (http://localhost:40960)...');
  const out = openSync(opencodeLogFile, 'a');
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
  writeFileSync(opencodePidFile, JSON.stringify({ opencode: child.pid }, null, 2));
  closeSync(out);
  const earlyExit = new Promise((resolve) => {
    child.on('exit', (code) => resolve(code));
  });
  const outcome = await Promise.race([
    waitPort(40960, 30000, 1000).then((ok) => ({ ok, exit: null })),
    earlyExit.then((code) => ({ ok: false, exit: code })),
  ]);
  if (outcome.exit !== null) {
    if (outcome.exit === 127) {
      throw new Error(
        'opencode が PATH にありません。`npm i -g opencode-ai` 等でインストールしてください。',
      );
    }
    throw new Error(
      `opencode serve が異常終了しました (code=${outcome.exit})。ログ: ${opencodeLogFile}`,
    );
  }
  if (!outcome.ok) {
    console.warn(
      `[dev] 警告: opencode serve が 30 秒以内に起動しませんでした。ログ: ${opencodeLogFile}`,
    );
  }
  return child;
}

/** 残存 stale PID ファイルを検証し、実在しない opencode なら削除する。 */
function reconcileStalePid() {
  const pid = readPid(opencodePidFile);
  if (pid && !isOpencodeProcess(pid)) {
    console.warn(
      `[dev] 警告: 古い PID ファイル (pid=${pid}) のプロセスが opencode ではないため削除します。`,
    );
    rmSync(opencodePidFile, { force: true });
  }
}

function main() {
  const cleanup = () => {
    if (opencodeChild) {
      killTree(opencodeChild.pid);
      rmSync(opencodePidFile, { force: true });
    }
  };

  const exit = (code) => {
    cleanup();
    process.exit(code);
  };

  process.on('SIGINT', () => exit(130));
  process.on('SIGTERM', () => exit(143));
  process.on('SIGHUP', () => exit(129));

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
