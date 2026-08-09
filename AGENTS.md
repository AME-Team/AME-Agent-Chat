# AGENTS.md — AME Agent Chat

AI エージェント（OpenCode 等）が本リポジトリで作業する際の指針。

## プロジェクト概要

OpenCode（AI Agent）をリッチな UI で安全・低コスト運用する **Windows / Linux / macOS 対応** ローカル開発環境。
pnpm workspace モノレポ。要件は GitHub Issue #1（統合要件書）/ #2（チャット機能要件書）、および分割タスク #3〜#27 を参照。

## パッケージ構成

| パッケージ                   | パス                  | 役割                                                         |
| ---------------------------- | --------------------- | ------------------------------------------------------------ |
| `@ame-agent-chat/shared`     | `packages/shared`     | 共通型定義（Tier/Effort/Session/SSE/Command 等）             |
| `@ame-agent-chat/agent-core` | `packages/agent-core` | BFF（Hono）・LLM ルーター・OpenCode SDK 接続（ポート 30010） |
| `@ame-agent-chat/gatekeeper` | `packages/gatekeeper` | ファイル I/O 制御・承認フロー（Hono+SQLite・ポート 58780）   |
| `@ame-agent-chat/frontend`   | `packages/frontend`   | React PWA（Vite・ポート 51730）                              |

## 主要コマンド

```bash
pnpm install            # 依存インストール
pnpm typecheck          # 全パッケージ型チェック（tsc --noEmit）
pnpm lint               # ESLint（フラット設定）
pnpm lint:fix
pnpm format             # Prettier 整形
pnpm format:check
pnpm dev                # opencode serve 自動起動 + 全パッケージ並列 dev 起動
pnpm build              # 全パッケージビルド
pnpm start              # ワンコマンド起動（Docker + Gatekeeper + Frontend + ブラウザ）
pnpm stop               # 停止（コンテナ down + プロセス終了）
pnpm -r --filter <pkg> <script>  # 個別パッケージ実行
```

**注意**: 変更後は必ず `pnpm typecheck` / `pnpm lint` / `pnpm format:check` を実行して品質を担保すること。

### Docker（Agent Core + OpenCode 同居コンテナ）

```bash
WORKSPACE_DIR=$(pwd) docker compose up -d --build   # 起動
docker compose logs -f agent                         # ログ
docker compose down                                  # 停止
```

Frontend(51730)/Gatekeeper(58780) はホスト起動。コンテナは Agent Core(30010・公開) + OpenCode(40960・非公開) のみ。

**注意**: コンテナは `node`(uid 1000) で実行。Linux ホストでは `WORKSPACE_DIR` の所有 uid を 1000 に合わせること（Windows / macOS の Docker Desktop は自動解決）。

## ポート割当（要件 #1 §2.6）

| コンポーネント   | ポート                                                          |
| ---------------- | --------------------------------------------------------------- |
| Frontend (PWA)   | 51730                                                           |
| Agent Core (BFF) | 30010                                                           |
| OpenCode Server  | 40960（コンテナ内のみ / `pnpm dev` ではホスト自動起動）        |
| Gatekeeper API   | 58780（ホスト OS）※要件 §2.6 の 87880 は TCP 上限超過のため修正 |

## UI 設計

フロントエンド実装時は **ame-ui スキル**（`ame-ui-philosophy` / `ame-ui-typography`）に準拠すること。

- 8px グリッド・`rounded-md/lg`・引き算のデザイン・余白で構造化
- `--color-primary`（1ポイントカラー 5 プリセット）+ ライト/ダークモード
- Google Fonts（Noto 系）必須・i18n(ja/en)・WCAG 2.1 AA

## レビュー（AME AI Review System）

- pre-commit（Gate 1）と PR（Gate 2）の二重品質ゲート。
- PR で `/request-review` コメントで AI レビュー実行。
- 詳細は `.ame-review/`・`.claude/skills/review-round/SKILL.md`。
- 設定: `.ame-review/config.json`

## コーディング規約

- TypeScript 厳密モード（`tsconfig.base.json`）。`verbatimModuleSyntax` 有効 → 型は `import type`。
- コメントは必要最小限（コード意図が自明なら書かない）。
- 依存ライブラリ追加時は、それが既存スタックと整合するか確認すること。
