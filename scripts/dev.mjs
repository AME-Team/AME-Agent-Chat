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
  isOpencodeOnPort,
  isOpencodeAvailable,
  getPortPid,
  readPid,
  isWin,
} from './lib/process.mjs';

/** 起動した opencode プロセス (spawn 直後に参照可能にする) */
let opencodeChild = null;

async function startOpencode() {
  if (!isOpencodeAvailable()) {
    throw new Error(
      'opencode が PATH にありません。`npm i -g opencode-ai` 等でインストールしてください。',
    );
  }
  if (await isPortOpen(40960)) {
    if (isOpencodeOnPort(40960)) {
      console.log(
        '[dev] OpenCode Server (http://localhost:40960) は既に起動済みのためスキップします。',
      );
      reconcileStalePid();
      return null;
    }
    const pid = getPortPid(40960);
    const hint = pid
      ? `ポート 40960 を opencode 以外のプロセスが占有しています (pid=${pid})。プロセスを終了してから再実行してください。`
      : 'ポート 40960 が占有されていますが、プロセスを特定できませんでした。`lsof -iTCP:40960` 等で確認してから再実行してください。';
    throw new Error(hint);
  }
  console.log('[dev] OpenCode Server を起動 (http://localhost:40960)...');
  const out = openSync(opencodeLogFile, 'a');
  // 開発モード (#55): デバッグログ (DEBUG) と stderr へのログ出力を有効化する
  const child = spawn(
    'opencode',
    ['serve', '--port', '40960', '--hostname', '127.0.0.1', '--log-level', 'DEBUG', '--print-logs'],
    {
      cwd: Root,
      env: process.env,
      shell: true,
      detached: true,
      stdio: ['ignore', out, out],
    },
  );
  opencodeChild = child;
  child.unref();
  writeFileSync(opencodePidFile, JSON.stringify({ opencode: child.pid }, null, 2));
  closeSync(out);
  // spawn 失敗 (ex. コマンド不在・権限不足) は 'exit' が発火しないため、rejection として即中断する
  const earlyExit = new Promise((resolve, reject) => {
    child.on('exit', (code) => resolve(code));
    child.on('error', (err) => reject(err));
  });
  const outcome = await Promise.race([
    waitPort(40960, 30000, 1000).then((ok) => ({ ok, exit: null })),
    earlyExit.then((code) => ({ ok: false, exit: code })),
  ]);
  if (outcome.exit !== null) {
    // POSIX は 127、Windows (cmd.exe) は 9009 で「コマンド不在」を表す。
    // 事前に isOpencodeAvailable() で存在確認しているため、汎用の code 1 は含めない。
    const notFoundCodes = isWin ? new Set([9009, 127]) : new Set([127]);
    if (notFoundCodes.has(outcome.exit)) {
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
      // docs は VitePress のドキュメントサイト専用パッケージのためランタイム起動から除外
      // （`pnpm docs:dev` で個別起動する）。
      // 開発モード (#55): 配下のパッケージへ LOG_LEVEL=debug を伝播する
      const dev = spawn(
        'pnpm',
        ['-r', '--filter', '!@ame-agent-chat/docs', '--parallel', 'run', 'dev'],
        {
          cwd: Root,
          env: { ...process.env, LOG_LEVEL: 'debug' },
          shell: true,
          stdio: 'inherit',
        },
      );
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
