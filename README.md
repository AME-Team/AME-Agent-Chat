# AME Agent Chat

OpenCode（AI Agent）をリッチな UI で安全・低コスト運用する **Windows / Linux / macOS 対応** ローカル開発環境。

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
pnpm dev          # opencode serve を自動起動 + 全パッケージ並列起動
```

- Frontend: http://localhost:51730
- Agent Core API: http://localhost:30010
- OpenCode Server: http://localhost:40960（`opencode serve` が未起動の場合のみ自動起動。**自動起動した場合のみ** dev 終了時に自動停止）

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
- ※コンテナは `node`(uid 1000) で実行。Linux ホストの場合は `WORKSPACE_DIR` の所有 uid を 1000 に合わせること（Windows / macOS の Docker Desktop は自動解決）

## CORS 設定（外部公開・cloudflared トンネル）

Agent Core はフロントエンド（`http://localhost:51730`）からの API アクセスを既定で許可しています。ブラウザは `/api` へのリクエストに **Origin** ヘッダ（スキーム + ホスト + ポート）を付与するため、Agent Core はこれを検証して許可/拒否を判定します。

- ローカル開発（既定）: `http://localhost:51730` が許可されるため、**設定変更は不要**
- **cloudflared トンネル等で外部公開する場合**: ブラウザの Origin がトンネルドメイン（例: `https://ame-agent-chat.tamtarminworldjapan.win`）になるため、`CORS_ORIGIN` に追加が必要

### 設定例

**ローカル開発のみ（既定のまま）**

```bash
CORS_ORIGIN=http://localhost:51730
```

**cloudflared トンネルで公開（複数オリジンはカンマ区切り）**

```bash
CORS_ORIGIN=http://localhost:51730,https://ame-agent-chat.tamtarminworldjapan.win
```

**Docker での設定**（`docker-compose.yml` は `CORS_ORIGIN: ${CORS_ORIGIN:-http://localhost:51730}` を参照）

```bash
CORS_ORIGIN=http://localhost:51730,https://ame-agent-chat.tamtarminworldjapan.win docker compose up -d --build
# または .env ファイルに記載
```

### 記法のルール

| ルール               | 説明                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 完全一致             | ブラウザの Origin と**完全一致**で比較。末尾スラッシュや明示ポート（`https://host:443`）は一致しない                                                      |
| カンマ区切り         | 複数オリジンをカンマ区切りで指定可能（前後の空白は自動除去）                                                                                              |
| `*` のみ             | 要素として単独の `*` だけ指定すると全オリジン許可（従来互換）。`*` と明示エントリの混在は**フェイルクローズ**となり、`*` は無視されて明示エントリのみ有効 |
| ワイルドカード非対応 | `https://*.example.com` のようなサブドメインワイルドカードは**サポートされない**（リテラルとして扱われ一致しない）                                        |

### 403 が出る場合の確認手順

1. `CORS_ORIGIN` にアクセス元の Origin が含まれているか（ブラウザのアドレスバーの URL と完全一致）を確認
2. 末尾スラッシュや `:443` 等の明示ポートが混入していないか確認
3. 混在設定（`*` + 明示）の場合は `*` が無効化されている点に注意
4. ターミナル API・ログダウンロードは**さらに共有トークン検証**を要求するため、Origin 設定だけでなくフロントエンドからの正規アクセスであることも必要（`X-Forwarded-Host` 等のクライアント制御可能なヘッダは信用しない設計）

## スクリプト

```bash
pnpm start        # ワンコマンド起動（Docker + Gatekeeper + Frontend + ブラウザ）
pnpm stop         # 停止（コンテナ down + プロセス終了）
pnpm typecheck    # 型チェック
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm build        # ビルド
```

## ドキュメント

ドキュメントサイト（VitePress・ja/en 対応）は GitHub Pages で公開しています。

- **公開サイト**: https://tarminjapan.github.io/AME-Agent-Chat/
- ローカル: `pnpm docs:dev` → http://localhost:51740

> **注意**: 初回のみ、リポジトリ設定（Settings → Pages）で Source を「GitHub Actions」に変更してください。`.github/workflows/docs-deploy.yml` がビルド結果を GitHub Pages にデプロイします。

内容:

- 要件定義: GitHub Issue #1（統合）/ #2（チャット機能）
- タスク分割: Issue #3〜#27
- AI エージェント指針: `AGENTS.md`
- 品質ゲート: `.ame-review/`（AME AI Review System）
