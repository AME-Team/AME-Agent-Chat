# API リファレンス

フロントエンドが利用する API をまとめます。すべての API は Agent Core（BFF）経由でアクセスし、ブラウザからは `/api` パスで利用します（Vite プロキシで 30010 へ転送）。

## ヘルスチェック

| メソッド | パス      | 説明                                                               |
| -------- | --------- | ------------------------------------------------------------------ |
| GET      | `/health` | ヘルスチェック。OpenCode の到達性に応じて `ok` / `degraded` を返す |
| GET      | `/meta`   | アプリ名・バージョン・ポート情報                                   |

## セッション

| メソッド | パス                        | 説明                          |
| -------- | --------------------------- | ----------------------------- |
| GET      | `/api/sessions`             | セッション一覧                |
| POST     | `/api/sessions`             | セッション作成                |
| GET      | `/api/sessions/:id`         | セッション取得                |
| PATCH    | `/api/sessions/:id`         | リネーム                      |
| DELETE   | `/api/sessions/:id`         | 削除                          |
| POST     | `/api/sessions/:id/fork`    | メッセージ地点からフォーク    |
| POST     | `/api/sessions/:id/share`   | セッション共有                |
| POST     | `/api/sessions/:id/unshare` | 共有解除                      |
| GET      | `/api/search?q=`            | 全文検索（Gatekeeper へ中継） |
| POST     | `/api/import`               | セッションの JSON インポート  |

## カレントディレクトリ（Issue #56）

| メソッド | パス       | 説明                                                                             |
| -------- | ---------- | -------------------------------------------------------------------------------- |
| GET      | `/api/cwd` | 現在のカレントディレクトリと選択可能なプロジェクト一覧（`current` / `projects`） |
| POST     | `/api/cwd` | `{ "directory": "/path" }` でカレントディレクトリを選択し、Gatekeeper へ永続化   |

## メッセージ

| メソッド | パス                          | 説明                                                   |
| -------- | ----------------------------- | ------------------------------------------------------ |
| GET      | `/api/sessions/:id/messages`  | メッセージ一覧                                         |
| POST     | `/api/sessions/:id/messages`  | メッセージ送信（`!` bash・`@` ファイル参照・添付対応） |
| POST     | `/api/sessions/:id/abort`     | 生成中断                                               |
| POST     | `/api/sessions/:id/command`   | スラッシュコマンド実行                                 |
| POST     | `/api/sessions/:id/summarize` | 履歴の要約圧縮（`/compact`）                           |
| POST     | `/api/sessions/:id/init`      | AGENTS.md 作成・更新（`/init`）                        |
| GET      | `/api/files?q=`               | `@` 参照用のファイル検索                               |
| GET      | `/api/ogp?url=`               | OGP リンクプレビュー（SSRF 対策付き）                  |

## イベント（SSE）

| メソッド | パス          | 説明                                                                                                                                           |
| -------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| GET      | `/api/events` | OpenCode のイベントをプロキシ。`message.updated`・`message.part.updated`・`session.idle`・`permission.updated` などを配信（15 秒ハートビート） |

## 権限・承認

| メソッド | パス                            | 説明                                                             |
| -------- | ------------------------------- | ---------------------------------------------------------------- |
| POST     | `/api/permissions/:id/decision` | 承認 / 常に許可 / 拒否の決定を OpenCode へ送信し、監査ログに記録 |
| GET      | `/api/permissions/history`      | 承認履歴の取得                                                   |

## 設定・使用量

| メソッド | パス            | 説明                          |
| -------- | --------------- | ----------------------------- |
| GET      | `/api/settings` | 設定の取得（Gatekeeper から） |
| PUT      | `/api/settings` | 設定の保存（Gatekeeper へ）   |
| GET      | `/api/usage`    | トークン使用量・コストの集計  |

## モデル

| メソッド | パス             | 説明                       |
| -------- | ---------------- | -------------------------- |
| GET      | `/api/providers` | 利用可能なプロバイダー一覧 |
| GET      | `/api/models`    | モデル一覧                 |
| GET      | `/api/commands`  | スラッシュコマンド定義     |

## 認証

| メソッド | パス                  | 説明                   |
| -------- | --------------------- | ---------------------- |
| GET      | `/api/auth/providers` | 認証プロバイダー一覧   |
| POST     | `/api/auth/login`     | プロバイダー認証の開始 |

## バックエンド内部 API（Gatekeeper）

Agent Core から呼び出される内部 API です。直接参照する必要は通常ありません。

| メソッド | パス                          | 説明                         |
| -------- | ----------------------------- | ---------------------------- |
| POST     | `/api/policy/validate`        | パス・コマンドのポリシー判定 |
| POST     | `/api/approvals`              | 権限要求の登録と判定         |
| GET      | `/api/approvals?status=`      | 未処理 / 履歴の取得          |
| POST     | `/api/approvals/:id/decision` | 承認判断の記録               |
| GET      | `/api/approvals/history`      | 監査ログ                     |
| POST     | `/api/usage`                  | トークン使用量の記録         |

## 注意事項

- SSE 以外は JSON を返します。
- OpenCode に到達できない場合は 503 を返し、内部エラーは開示しません。
- エンドポイントの実装は `packages/agent-core/src/routes/` にあります。
