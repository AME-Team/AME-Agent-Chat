#!/usr/bin/env node
/**
 * pre-commit フック (node-modules-check) 用: 導入済み ESLint が --no-warn-ignored に
 * 必要な 9.20+ であることを検証する。
 */
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('./node_modules/eslint/package.json', 'utf8'));
const [major, minor] = version.split('.').map(Number);
if (major < 9 || (major === 9 && minor < 20)) {
  console.error(`ESLint >=9.20 が必要です (現在 ${version})`);
  process.exit(1);
}
