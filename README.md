# AME Agent Chat

OpenCode（AI Agent）をリッチな UI で安全・低コスト運用する **Windows 専用** ローカル開発環境。

## 構成

pnpm workspace モノレポ。

| パッケージ            | 役割                                              | ポート |
| --------------------- | ------------------------------------------------- | ------ |
| `packages/frontend`   | React PWA（Vite + React + shadcn/ui）             | 51730  |
| `packages/agent-core` | BFF（Hono）・OpenCode SDK 接続・LLM ルーター      | 30010  |
| `packages/gatekeeper` | ファイル I/O 制御・承認フロー（Hono + SQLite）    | 58780  |
| `packages/shared`     | 共通型定義                                        | —      |
| `docker/`             | コンテナ定義（Agent Core + OpenCode Server 同居） | —      |

> OpenCode Server はコンテナ内 `localhost:40960`（非公開）。

> Gatekeeper の SQLite DB は `packages/gatekeeper/data/ame.db` に保存される（CWD 非依存）。
> 旧バージョンでカレントディレクトリ基準の `data/ame.db` に保存していた場合、初回起動時に自動で引き継がれる。

## クイックスタート

### ローカル開発（ホストで各パッケージ起動）

```bash
pnpm install
pnpm dev          # 全パッケージ並列起動
```

- Frontend: http://localhost:51730
- Agent Core API: http://localhost:30010

### Docker（Agent Core + OpenCode をコンテナで同居起動）

Frontend(51730) と Gatekeeper(58780) はホスト側で起動し、コンテナ内では Agent Core(30010・公開) と OpenCode Server(40960・非公開) が同居します（要件 #1 §2.4）。

```bash
# ホストワークスペースを /workspace へ bind mount (既定はカレントディレクトリ)
WORKSPACE_DIR=$(pwd) docker compose up -d --build
docker compose logs -f agent      # OpenCode + Agent Core のログ
docker compose down
```

- `CORS_ORIGIN` / `WORKSPACE_DIR` は環境変数で上書き可能
- OpenCode Server(40960) はコンテナ内のみ（非公開）
- ※コンテナは `node`(uid 1000) で実行。Linux ホストの場合は `WORKSPACE_DIR` の所有 uid を 1000 に合わせること（Windows Docker Desktop は自動解決）

## スクリプト

```bash
pnpm typecheck    # 型チェック
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm build        # ビルド
```

## ドキュメント

- 要件定義: GitHub Issue #1（統合）/ #2（チャット機能）
- タスク分割: Issue #3〜#27
- AI エージェント指針: `AGENTS.md`
- 品質ゲート: `.ame-review/`（AME AI Review System）
