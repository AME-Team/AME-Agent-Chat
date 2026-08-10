# アーキテクチャ概要

AME Agent Chat は **pnpm workspace モノレポ** で構成された 5 つのパッケージと、バックエンドで動作する OpenCode Server から成ります。うち 4 つ（frontend / agent-core / gatekeeper / shared）がランタイムで、`docs` は本ドキュメントサイト（VitePress）を提供するドキュメント専用パッケージです。

## 全体構成

<ArchitectureDiagram variant="ja" />

## 各コンポーネントの役割

| パッケージ            | 役割                                                                        | ポート       |
| --------------------- | --------------------------------------------------------------------------- | ------------ |
| `packages/frontend`   | React PWA。チャット UI・セッション管理・設定 UI                             | 51730        |
| `packages/agent-core` | Hono 製 BFF。OpenCode SDK 接続・LLM ルーター・SSE プロキシ・承認連携        | 30010        |
| `packages/gatekeeper` | Hono + SQLite。ファイル I/O ポリシー判定・永続化・承認監査・使用量集計      | 58780        |
| `packages/shared`     | 共通型定義（Tier / Effort / Session / SSE / Command など）                  | —            |
| `packages/docs`       | ドキュメントサイト（VitePress・ja/en・GitHub Pages 公開）。ランタイム対象外 | 51740（dev） |

## リクエストの流れ

1. フロントエンドの入力 → Agent Core の `POST /api/sessions/:id/messages` に送信
2. Agent Core が特殊記法（`!` bash、`@` ファイル参照）を処理し、必要なら履歴を圧縮
3. **LLM ルーター** がタスク内容からティア（high / middle / low）を判定し、モデルを選択
4. OpenCode SDK 経由で OpenCode Server にプロンプトを送信
5. 応答は SSE（`/api/events`）でリアルタイムにフロントへ配信

## 承認フローの流れ

1. OpenCode が権限要求（`permission.updated`）を発行
2. Agent Core の SSE プロキシが検知し、Gatekeeper `POST /api/approvals` に送信
3. Gatekeeper がポリシー判定 → 許可 / 承認 / 拒否
4. 承認が必要な場合はフロントにダイアログ表示 → ユーザーが判断
5. Agent Core が結果を OpenCode に送信し、判断を監査ログに記録

## 実行モード

同じコードベースで 2 つの実行モードをサポートします。

| モード             | Agent Core / OpenCode                          | 起動方法     |
| ------------------ | ---------------------------------------------- | ------------ |
| ローカル開発モード | ホストで並列起動                               | `pnpm dev`   |
| ワンコマンド起動   | Agent Core + OpenCode を Docker コンテナで同居 | `pnpm start` |

どちらのモードでも Frontend（51730）と Gatekeeper（58780）はホストで動作します。コンテナ内では 40960（OpenCode）は非公開のため、外部からは直接アクセスできません。

## 詳細

- [フロントエンド](/architecture/frontend)
- [Agent Core（BFF）](/architecture/agent-core)
- [Gatekeeper](/architecture/gatekeeper)
- [Docker 構成](/architecture/docker)
- [セキュリティ](/architecture/security)
