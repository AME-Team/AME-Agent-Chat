#!/usr/bin/env node
/**
 * AME Agent Chat — リリースパッケージ生成
 * Git タグ (例: v1.2.3) を元に、配布用ソースアーカイブ (zip / tar.gz) を生成する。
 *
 * 用途: ユーザーがリリースアーカイブをダウンロード → 展開 → `pnpm install`
 *       → `pnpm start` で起動できる、自己完結ソースパッケージを提供する。
 *
 * 生成物: dist/ame-agent-chat-<version>.zip
 *         dist/ame-agent-chat-<version>.tar.gz
 */
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(Root, 'dist');
const stagingRoot = path.join(Root, '.release-staging');

const isWin = process.platform === 'win32';

/** 配布に含めるルート直下のファイル/ディレクトリ (git 管理下の成果物系を除外済み) */
const KEEP_FILES = [
  'AGENTS.md',
  'README.md',
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'tsconfig.base.json',
  'tsconfig.json',
  '.node-version',
  '.editorconfig',
  '.gitignore',
  '.prettierrc.json',
  '.prettierignore',
  '.dockerignore',
  'docker-compose.yml',
  'docker',
  'scripts',
  'packages',
];

/** コピー時に除外する相対パス (成果物/キャッシュ系) */
const EXCLUDES = [
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.vitepress/cache',
  '.vitepress/dist',
  '.ame-review/engines-ts/node_modules',
  '.serena',
];

/** パスセグメントごとに除外判定 (例: packages/agent-core/node_modules も除外対象) */
const isExcluded = (rel) => {
  const segs = rel.split('/');
  return segs.some((seg) => EXCLUDES.includes(seg));
};

const listEntries = (dir) => readdirSync(dir, { withFileTypes: true });

/** 出力ディレクトリを空にして、配布するファイル群をステージングへコピーする。 */
const prepareStaging = (version) => {
  const staging = path.join(stagingRoot, version);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  for (const f of KEEP_FILES) {
    const src = path.join(Root, f);
    if (!existsSync(src)) continue;
    const dest = path.join(staging, f);
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(src, dest, {
      recursive: true,
      filter: (s) => {
        const rel = path.relative(Root, s);
        return !isExcluded(rel);
      },
    });
  }

  // packages 配下を個別コピー (node_modules / 成果物を除外)
  const pkgDir = path.join(Root, 'packages');
  for (const entry of listEntries(pkgDir)) {
    if (!entry.isDirectory()) continue;
    const src = path.join(pkgDir, entry.name);
    const dest = path.join(staging, 'packages', entry.name);
    mkdirSync(path.dirname(dest), { recursive: true });
    cpSync(src, dest, {
      recursive: true,
      filter: (s) => {
        const rel = path.relative(Root, s);
        return !isExcluded(rel);
      },
    });
  }
  return staging;
};

/** バージョンをタグから解決 (ex. v1.2.3 → 1.2.3)。タグが無ければ package.json の version。 */
const resolveVersion = () => {
  const tag = process.env.GITHUB_REF_NAME || '';
  const m = tag.match(/^v?(\d+\.\d+\.\d+.*)$/);
  if (m) return m[1];
  const pkg = JSON.parse(readFileSync(path.join(Root, 'package.json'), 'utf8'));
  return pkg.version || '0.0.0';
};

const createZip = (staging, version) => {
  const name = `ame-agent-chat-${version}.zip`;
  const target = path.join(outDir, name);
  // Windows は tar -a が拡張子から zip を生成可能。それ以外は zip コマンドを使用する。
  const cmd = isWin
    ? ['tar', ['-a', '-c', '-f', target, path.basename(staging)]]
    : ['zip', ['-rq', target, path.basename(staging)]];
  const { status } = spawnSync(cmd[0], cmd[1], { cwd: path.dirname(staging), stdio: 'inherit' });
  if (status !== 0) throw new Error(`zip 作成に失敗しました: ${name}`);
  return name;
};

const createTarGz = (staging, version) => {
  const name = `ame-agent-chat-${version}.tar.gz`;
  const target = path.join(outDir, name);
  const { status } = spawnSync(
    'tar',
    ['-czf', target, '-C', path.dirname(staging), path.basename(staging)],
    { stdio: 'inherit' },
  );
  if (status !== 0) throw new Error(`tar.gz 作成に失敗しました: ${name}`);
  return name;
};

const copyReadme = () => {
  const src = path.join(Root, 'README.md');
  const dest = path.join(outDir, 'README.md');
  if (existsSync(src)) {
    copyFileSync(src, dest);
  }
};

const main = () => {
  const version = resolveVersion();
  console.log(`[package-release] バージョン: ${version}`);

  // 必須外部コマンドの存在確認
  const needs = isWin ? ['tar'] : ['zip', 'tar'];
  const which = isWin ? 'where' : 'which';
  for (const cmd of needs) {
    if (spawnSync(which, [cmd], { stdio: 'ignore' }).status !== 0) {
      throw new Error(`必要なコマンドがありません: ${cmd}`);
    }
  }

  mkdirSync(outDir, { recursive: true });
  rmSync(stagingRoot, { recursive: true, force: true });
  const staging = prepareStaging(version);
  const names = [createZip(staging, version), createTarGz(staging, version)];
  rmSync(stagingRoot, { recursive: true, force: true });

  for (const n of names) {
    const abs = path.join(outDir, n);
    console.log(
      `[package-release] 生成: ${abs} (${(statSync(abs).size / 1024 / 1024).toFixed(1)} MB)`,
    );
  }
  copyReadme();
};

try {
  main();
} catch (err) {
  console.error(`エラー: ${err.message}`);
  process.exit(1);
}
