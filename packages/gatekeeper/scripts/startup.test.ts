/**
 * Gatekeeper 起動契約の統合テスト (node:test)
 * ワークスペースルート (CWD 非依存) からサーバーを起動し、
 * 起動時マイグレーションが適用されて /api/settings が 200 を返すことを検証する。
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

const workspaceRoot = fileURLToPath(new URL('../../..', import.meta.url));
const tsxCli = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));

let child: ChildProcess | undefined;
let baseUrl = '';
let dbDir = '';

before(async () => {
  dbDir = mkdtempSync(join(tmpdir(), 'gatekeeper-startup-'));
  const port = 60000 + Math.floor(Math.random() * 1000);
  baseUrl = `http://127.0.0.1:${port}`;

  const proc = spawn(
    process.execPath,
    [tsxCli, join('packages', 'gatekeeper', 'src', 'index.ts')],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        AME_DB_PATH: join(dbDir, 'ame.db'),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  child = proc;

  const stderr: string[] = [];
  proc.stderr?.on('data', (chunk) => stderr.push(String(chunk)));

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('server did not start')), 15000);
    proc.stdout?.on('data', (chunk) => {
      if (String(chunk).includes('listening')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    proc.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`server exited early with code ${code}: ${stderr.join('')}`));
    });
  });
});

after(async () => {
  const proc = child;
  if (proc) {
    proc.kill('SIGTERM');
    // Windows で子プロセスが DB ファイルを掴んだまま削除すると EPERM になるため、exit を待ってから削除する
    await new Promise<void>((resolve) => {
      if (proc.exitCode !== null && proc.exitCode !== undefined) return resolve();
      proc.once('exit', () => resolve());
    });
  }
  if (dbDir) rmSync(dbDir, { recursive: true, force: true });
});

test('起動時にマイグレーションが適用され /api/settings が 200 を返す', async () => {
  const res = await fetch(`${baseUrl}/api/settings`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {});
});

test('/health が 200 を返す', async () => {
  const res = await fetch(`${baseUrl}/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { status: string };
  assert.equal(body.status, 'ok');
});

test('AME_WORKSPACE_ROOT が設定時、/api/policy/workspace は env ルートを優先して返す', async () => {
  const dbDir2 = mkdtempSync(join(tmpdir(), 'gatekeeper-wsroot-'));
  const port = 61000 + Math.floor(Math.random() * 1000);
  const url = `http://127.0.0.1:${port}`;
  const envRoot = '/env/workspace-root';
  const proc: ChildProcess = spawn(
    process.execPath,
    [tsxCli, join('packages', 'gatekeeper', 'src', 'index.ts')],
    {
      cwd: workspaceRoot,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        AME_DB_PATH: join(dbDir2, 'ame.db'),
        AME_WORKSPACE_ROOT: envRoot,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  const stderr2: string[] = [];
  proc.stderr?.on('data', (chunk) => stderr2.push(String(chunk)));
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('server did not start')), 15000);
      proc.stdout?.on('data', (chunk) => {
        if (String(chunk).includes('listening')) {
          clearTimeout(timeout);
          resolve();
        }
      });
      proc.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`server exited early with code ${code}: ${stderr2.join('')}`));
      });
    });
    const res = await fetch(`${url}/api/policy/workspace`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { workspaceRoot: string };
    assert.equal(body.workspaceRoot, envRoot);
  } finally {
    proc.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      if (proc.exitCode !== null && proc.exitCode !== undefined) return resolve();
      proc.once('exit', () => resolve());
    });
    rmSync(dbDir2, { recursive: true, force: true });
  }
});
