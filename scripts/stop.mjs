#!/usr/bin/env node
/**
 * AME Agent Chat — ワンコマンド停止
 * クロスプラットフォーム対応: Windows / Linux / macOS
 *
 * Agent コンテナ停止 → Gatekeeper / Frontend プロセス終了 → OpenCode (dev モード) 終了
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import {
  Root,
  pidsFile,
  opencodePidFile,
  killTree,
  isOpencodeProcess,
  readPid,
  getPortPid,
} from './lib/process.mjs';

console.log('Agent コンテナを停止...');
const down = spawnSync('docker', ['compose', '-f', 'docker-compose.yml', 'down'], {
  cwd: Root,
  stdio: 'inherit',
});
if (down.status !== 0) {
  console.warn('警告: docker compose down に失敗しました。コンテナが残っている場合があります。');
}

console.log('Gatekeeper / Frontend プロセスを終了...');
if (existsSync(pidsFile)) {
  const { gatekeeper, frontend } = JSON.parse(readFileSync(pidsFile, 'utf8'));
  for (const pid of [gatekeeper, frontend]) {
    if (pid) killTree(pid);
  }
  rmSync(pidsFile, { force: true });
} else {
  console.log('PID ファイルが見つかりません。手動でプロセスを終了してください。');
}

console.log('OpenCode Server プロセスを終了 (dev モード)...');
const opencodePid = readPid(opencodePidFile);
if (opencodePid) {
  // dev.mjs は detached シェル (プロセスグループリーダー) として起動するため、
  // killTree のプロセスグループキル (-pid / taskkill /T) で opencode 本体まで停止できる。
  // 念のため対象が opencode であることを検証してから kill する (PID 再利用対策)。
  if (isOpencodeProcess(opencodePid)) {
    killTree(opencodePid);
  } else {
    console.warn(
      `警告: PID ${opencodePid} は opencode プロセスではないため終了しません。ファイルのみ削除します。`,
    );
  }
  rmSync(opencodePidFile, { force: true });
} else {
  console.log('OpenCode PID ファイルが見つかりません。');
}

// SIGKILL 等で dev.mjs の cleanup が走らず、PID ファイル無しで opencode が残存している場合の復旧。
// ※dev.mjs が起動した分に限らず、ポート 40960 を占有する opencode serve は全て停止対象とする
//   （`pnpm stop` は「全停止」コマンドであり、手動起動分も意図的に終了する）。
//   取得と検証は kill 直前の単一実行とし、null ガード + 対象検証の両方を満たしてから kill する
//   （TOCTOU と PID 再利用・誤 kill の回避）。
const portPid = getPortPid(40960);
if (portPid !== null && isOpencodeProcess(portPid)) {
  console.log(`ポート 40960 を占有する opencode プロセス (pid=${portPid}) を終了...`);
  killTree(portPid);
}

console.log('停止しました。');
