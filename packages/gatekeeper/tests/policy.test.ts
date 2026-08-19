/**
 * ファイル I/O ポリシーエンジン (policy.ts) のユニットテスト (要件 #1 §3.4, #2 §7.1)
 * opencode の権限リクエスト (permission.updated) に対する分類結果を検証する。
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, isWithinWorkspace } from '../src/policy.js';

const WS = join(tmpdir(), 'ame-policy-test');

test('isWithinWorkspace: 絶対パスはワークスペース内/外を正しく判定', () => {
  assert.equal(isWithinWorkspace(join(WS, 'src', 'app.ts'), WS), true);
  assert.equal(isWithinWorkspace(join(WS, '..', 'outside.ts'), WS), false);
  assert.equal(isWithinWorkspace('/etc/passwd', WS), false);
});

test('isWithinWorkspace: 相対パスはルート起点で解決する', () => {
  assert.equal(isWithinWorkspace('src/app.ts', WS), true);
  assert.equal(isWithinWorkspace('../outside.ts', WS), false);
});

test('classify: ホスト OS でのシェル/プロセス実行は deny', () => {
  assert.equal(classify({ type: 'execute' }, WS).action, 'deny');
  assert.equal(classify({ type: 'bash', command: 'sh deploy.sh' }, WS).action, 'deny');
  // description (タイトル) の語では deny しない (コマンド本体が決め手)。npm install は approval
  assert.equal(
    classify({ type: 'bash', command: 'npm install', description: 'bash deploy.sh' }, WS).action,
    'approval',
  );
});

test('classify: パッケージインストールは approval', () => {
  assert.equal(classify({ type: 'bash', command: 'npm install' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'npm i' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'npm ci' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'pnpm ci' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'npm run install' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'pnpm add lodash' }, WS).action, 'approval');
  // 主要なパッケージマネージャ (pip/pip3/uv/poetry/cargo/go 等) も捕捉する
  assert.equal(classify({ type: 'bash', command: 'pip3 install requests' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'pip install requests' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: 'python -m pip install x' }, WS).action,
    'approval',
  );
  assert.equal(classify({ type: 'bash', command: 'uv pip install x' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'poetry add x' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'cargo install x' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'go install x' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'pnpm i' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: 'pnpm --filter x install' }, WS).action,
    'approval',
  );
  assert.equal(
    classify({ type: 'bash', command: 'yarn workspace x add y' }, WS).action,
    'approval',
  );
  assert.equal(
    classify({ type: 'package-install', command: 'pip install requests' }, WS).action,
    'approval',
  );
  assert.equal(classify({ type: 'bash', command: 'npm run build' }, WS).action, 'allow');
});

test('classify: bash で command 欠落時は path (pattern のコマンド文字列) で判定する', () => {
  // agent-core は metadata.command 欠落時に pattern を command へフォールバックさせるが、
  // Gatekeeper 側でも pattern 単独 (path にコマンド文字列) からインストールを検知できること。
  assert.equal(classify({ type: 'bash', path: 'npm install', command: '' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', path: ['npm', 'install'], command: '' }, WS).action,
    'approval',
  );
  assert.equal(classify({ type: 'bash', path: 'git status', command: '' }, WS).action, 'allow');
});

test('classify: 破壊的操作 (rm / mv / dd / 再起動 / システム上書き / 直接実行) は approval', () => {
  assert.equal(classify({ type: 'bash', command: 'rm -rf node_modules' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'rm -r src' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'rm -f /etc/hosts' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'rm /etc/passwd' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'rm foo.txt' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'mv a b' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: 'dd if=/dev/zero of=disk.img' }, WS).action,
    'approval',
  );
  assert.equal(classify({ type: 'bash', command: 'shutdown -h now' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'echo x > /etc/passwd' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: './deploy.sh' }, WS).action, 'approval');
  // システムログ等への書き込み (/var/log) も破壊的操作として承認を要求する
  assert.equal(
    classify({ type: 'bash', command: '/usr/bin/app > /var/log/app.log' }, WS).action,
    'approval',
  );
  // 通常のリダイレクト (/dev/null /tmp) は過剰承認しない
  assert.equal(classify({ type: 'bash', command: 'git status > /dev/null' }, WS).action, 'allow');
  assert.equal(
    classify({ type: 'bash', command: 'npm run build > /dev/null 2>&1' }, WS).action,
    'allow',
  );
  // 非破壊コマンド / git サブコマンドは allow
  assert.equal(classify({ type: 'bash', command: 'git status' }, WS).action, 'allow');
  assert.equal(classify({ type: 'bash', command: 'git rm foo' }, WS).action, 'allow');
  assert.equal(classify({ type: 'bash', command: 'git mv a b' }, WS).action, 'allow');
  assert.equal(classify({ type: 'bash', command: 'pnpm format' }, WS).action, 'allow');
  assert.equal(classify({ type: 'bash', command: 'pnpm format:check' }, WS).action, 'allow');
});

test('classify: ファイルパスが破壊的コマンド名と同名でも誤判定しない', () => {
  // パス判定ではコマンド寄りヒューリスティクスを適用しないため、mv/dd/shutdown 等の
  // 語を含むファイル名・ディレクトリ名でもワークスペース内なら allow になる。
  assert.equal(classify({ type: 'edit', path: join(WS, 'scripts', 'mv.ts') }, WS).action, 'allow');
  assert.equal(
    classify({ type: 'edit', path: join(WS, 'README-shutdown.md') }, WS).action,
    'allow',
  );
  assert.equal(classify({ type: 'read', path: join(WS, 'dd') }, WS).action, 'allow');
});

test('classify: パッケージ除去・sudo/連鎖コマンドも判定する', () => {
  // パッケージ除去
  assert.equal(classify({ type: 'bash', command: 'npm uninstall lodash' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'pnpm remove x' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'yarn remove y' }, WS).action, 'approval');
  // install 語が command 先頭以外 (コミットメッセージ等) では過剰承認しない
  assert.equal(
    classify({ type: 'bash', command: 'git commit -m "npm install 手順"' }, WS).action,
    'allow',
  );
  assert.equal(classify({ type: 'bash', command: 'echo npm install' }, WS).action, 'allow');
  // sudo/doas 前置き + 連鎖 (&&/;/||) の破壊コマンド
  assert.equal(classify({ type: 'bash', command: 'sudo rm -rf /' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'cd /tmp && rm -rf src' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'doas dd if=x of=y' }, WS).action, 'approval');
  // 連鎖内の非破壊コマンドは allow
  assert.equal(classify({ type: 'bash', command: 'cd /tmp && git status' }, WS).action, 'allow');
  // bun / npx install と git の破壊的操作
  assert.equal(classify({ type: 'bash', command: 'bun install' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: 'npx playwright install' }, WS).action,
    'approval',
  );
  assert.equal(classify({ type: 'bash', command: 'git clean -fd' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'git clean -f' }, WS).action, 'approval');
  // dry-run は非破壊のため allow
  assert.equal(classify({ type: 'bash', command: 'git clean --dry-run' }, WS).action, 'allow');
  assert.equal(classify({ type: 'bash', command: 'git reset --hard' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'git checkout -- .' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'git checkout .' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'git restore .' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: 'git restore --source HEAD~1 config.ts' }, WS).action,
    'approval',
  );
  assert.equal(classify({ type: 'bash', command: 'git restore foo.ts' }, WS).action, 'approval');
  // --staged は非破壊 (ステージ解除) のため allow
  assert.equal(
    classify({ type: 'bash', command: 'git restore --staged foo.ts' }, WS).action,
    'allow',
  );
  // 非破壊の git / npx コマンドは allow
  assert.equal(classify({ type: 'bash', command: 'git reset --soft HEAD~1' }, WS).action, 'allow');
  assert.equal(classify({ type: 'bash', command: 'npx prettier' }, WS).action, 'allow');
  // インライン任意コード実行は approval / 通常のファイル実行は allow
  assert.equal(classify({ type: 'bash', command: "python -c 'rm -rf x'" }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: "node -e \"require('child_process').execSync('ls')\"" }, WS)
      .action,
    'approval',
  );
  assert.equal(
    classify({ type: 'bash', command: 'node --eval "console.log(1)"' }, WS).action,
    'approval',
  );
  assert.equal(classify({ type: 'bash', command: 'node -p 1' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'python script.py' }, WS).action, 'allow');
  assert.equal(classify({ type: 'bash', command: 'node server.js' }, WS).action, 'allow');
  // システムパスを引数に取る書き込み系コマンドは approval / ワークスペース内は allow
  assert.equal(classify({ type: 'bash', command: 'cp /tmp/x /etc/passwd' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'tee /etc/passwd' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: 'curl -o /etc/foo http://x' }, WS).action,
    'approval',
  );
  assert.equal(
    classify({ type: 'bash', command: 'install -m 755 a /usr/local/bin/x' }, WS).action,
    'approval',
  );
  // 書き込み先がシステムパスの場合のみ approval。ソースとしてのみ現れる読みコピーは allow
  // (システム破壊ではないため。末尾オペランド or -o/-t/-O 引数がシステムパスのとき承認)。
  assert.equal(classify({ type: 'bash', command: 'cp /etc/passwd /tmp/x' }, WS).action, 'allow');
  assert.equal(
    classify({ type: 'bash', command: 'curl -o /etc/foo http://x' }, WS).action,
    'approval',
  );
  assert.equal(classify({ type: 'bash', command: 'cp -t /etc/dir file' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'ln -s f /etc/link' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: 'cp /tmp/x /workspace/src/a.ts' }, WS).action,
    'allow',
  );
  assert.equal(classify({ type: 'bash', command: 'mkdir -p /workspace/dist' }, WS).action, 'allow');
});

test('classify: コマンド置換・間接削除は fail-closed (approval)', () => {
  assert.equal(classify({ type: 'bash', command: 'echo $(rm -rf /)' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: 'git log "$(npm install)"' }, WS).action,
    'approval',
  );
  assert.equal(classify({ type: 'bash', command: 'ls `grep x`' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'find . -delete' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'find . -exec rm {} +' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'xargs rm -rf' }, WS).action, 'approval');
});

test('classify: ファイル操作のタイトル/説明はコマンド誤判定しない', () => {
  // edit/read 等のパス種別ではコマンドヒューリスティクスを適用しないため、
  // タイトルに bash/install/破壊的語が含まれてもワークスペース内なら allow になる。
  assert.equal(
    classify({ type: 'edit', path: join(WS, 'doc.md'), description: 'Add bash usage doc' }, WS)
      .action,
    'allow',
  );
  assert.equal(
    classify({ type: 'edit', path: join(WS, 'README.md'), description: 'rm -rf note' }, WS).action,
    'allow',
  );
  assert.equal(
    classify({ type: 'read', path: join(WS, 'x.sh'), description: 'bash deploy' }, WS).action,
    'allow',
  );
});

test('classify: 通常の bash コマンドは allow (pattern をパスと誤認しない)', () => {
  // opencode は bash 権限で pattern にコマンド文字列を渡す
  assert.equal(classify({ type: 'bash', command: 'git status' }, WS).action, 'allow');
  assert.equal(
    classify({ type: 'bash', path: 'git status', command: 'git status' }, WS).action,
    'allow',
  );
});

test('classify: ワークスペース内 edit / read は allow', () => {
  assert.equal(
    classify(
      { type: 'edit', path: join(WS, 'src', 'app.ts'), command: '', description: 'src/app.ts' },
      WS,
    ).action,
    'allow',
  );
  assert.equal(classify({ type: 'read', path: join(WS, 'README.md') }, WS).action, 'allow');
});

test('classify: ワークスペース外 edit / external_directory は approval', () => {
  assert.equal(classify({ type: 'edit', path: '/etc/hosts' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'external_directory', path: ['/home/user/other/*'] }, WS).action,
    'approval',
  );
});

test('classify: path 配列は正規化して判定する', () => {
  assert.equal(
    classify({ type: 'edit', path: [join(WS, 'a.ts'), '/etc/passwd'] }, WS).action,
    'approval',
  );
  assert.equal(
    classify({ type: 'edit', path: [join(WS, 'a.ts'), join(WS, 'b.ts')] }, WS).action,
    'allow',
  );
});

test('classify: 非パス種別 (webfetch 等) はパス判定をしない', () => {
  assert.equal(classify({ type: 'webfetch', path: 'https://example.com' }, WS).action, 'allow');
  assert.equal(classify({ type: 'skill', path: 'ame-ui' }, WS).action, 'allow');
});

test('classify: パスベース操作でパス欠落時は fail-closed (approval)', () => {
  assert.equal(classify({ type: 'edit', path: undefined }, WS).action, 'approval');
  assert.equal(classify({ type: 'read', path: [] }, WS).action, 'approval');
});

test('classify: Windows 破壊的コマンドも捕捉する', () => {
  assert.equal(classify({ type: 'bash', command: 'del /s /q C:\\temp' }, WS).action, 'approval');
  assert.equal(classify({ type: 'bash', command: 'format c:' }, WS).action, 'approval');
  assert.equal(
    classify({ type: 'bash', command: 'taskkill /F /IM node.exe' }, WS).action,
    'approval',
  );
  assert.equal(
    classify({ type: 'bash', command: 'type x > C:\\Windows\\file' }, WS).action,
    'approval',
  );
});
