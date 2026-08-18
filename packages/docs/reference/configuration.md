# 設定リファレンス

各コンポーネントの環境変数と、ユーザー設定できる項目をまとめます。

::: tip 環境変数の読み込み
ローカル実行（`pnpm dev` / Gatekeeper の `pnpm start`）では、agent-core / gatekeeper の `dev` / `start` スクリプト（gatekeeper は `db:migrate` も）がパッケージ直下の `.env`（例: `packages/agent-core/.env`）を自動読み込みします（Node 標準の `--env-file-if-exists`）。frontend は Vite が独自にプロジェクトルートの `.env` を読み込むため対象外です。本フラグは Node v22.9.0+（または v20.19.0+）が必要で、本リポジトリは `.node-version` / `engines.node` / `docker/Dockerfile` とも Node 24 のため要件を満たします。agent-core / gatekeeper にある `.env.example` を対応する `packages/<pkg>/.env` へコピーして利用してください（frontend には `.env.example` はありません）。シェル等で既に設定済みの環境変数が `.env` の値より優先されます。

一方 Docker 経由で起動する Agent Core は `docker compose`（リポジトリ直下の `.env`）が渡す環境変数を使用します。コンテナのイメージは `.dockerignore` で `.env` を除外してビルドされ、起動も `/app`（ワークスペースのマウント先とは別）から行われるため、ホスト側の `packages/agent-core/.env` は Docker では参照されません。実行モードによって設定値の所在が異なるため、`CORS_ORIGIN` 等はモードごとに設定が必要です。また `.env` はパッケージごとに独立して読まれるため、複数パッケージで必要な変数は各パッケージの `.env` へ重複記載してください。
:::

## Agent Core の環境変数

| 変数                | 既定値                   | 説明                    |
| ------------------- | ------------------------ | ----------------------- |
| `PORT`              | `30010`                  | リッスンポート          |
| `HOST`              | `0.0.0.0`                | バインド先ホスト        |
| `OPENCODE_BASE_URL` | `http://localhost:40960` | OpenCode Server の URL  |
| `CORS_ORIGIN`       | `http://localhost:51730` | CORS で許可するオリジン |
| `GATEKEEPER_URL`    | `http://localhost:58780` | Gatekeeper API の URL   |

## Gatekeeper の環境変数

| 変数                 | 既定値                            | 説明                                                         |
| -------------------- | --------------------------------- | ------------------------------------------------------------ |
| `PORT`               | `58780`                           | リッスンポート                                               |
| `HOST`               | `0.0.0.0`                         | バインド先ホスト                                             |
| `CORS_ORIGIN`        | `http://localhost:51730`          | CORS で許可するオリジン                                      |
| `AME_WORKSPACE_ROOT` | 起動時 CWD                        | ポリシー判定で「ワークスペース内」を判定する基準ディレクトリ |
| `AME_DB_PATH`        | `packages/gatekeeper/data/ame.db` | SQLite データベースの保存先                                  |
| `NODE_ENV`           | —                                 | `production` のときエラーレスポンスから内部情報を隠蔽        |

::: tip
`AME_WORKSPACE_ROOT` は空の場合はポリシー判定で「ワークスペース外」扱いになるため、明示的に設定することを推奨します。
:::

## Docker / スクリプトの環境変数

| 変数             | 既定値                              | 説明                                                                                                 |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `WORKSPACE_DIR`  | カレントディレクトリ                | `docker compose` で `/workspace` に bind mount するディレクトリ（`pnpm start` ではリポジトリルート） |
| `CORS_ORIGIN`    | `http://localhost:51730`            | Docker Compose から Agent Core へ渡す CORS オリジン                                                  |
| `GATEKEEPER_URL` | `http://host.docker.internal:58780` | Docker Compose から Agent Core へ渡す Gatekeeper の URL                                              |

## アプリ設定（ユーザーが UI から変更）

### 外観

| 設定             | 選択肢                                                                            |
| ---------------- | --------------------------------------------------------------------------------- |
| テーマ           | `light` / `dark` / `system`                                                       |
| アクセントカラー | Trust Blue / Stable Green / Grounded Orange / Sophisticated Indigo / Clarity Teal |
| 言語             | `ja` / `en`                                                                       |

### モデル

| 設定              | 内容                                                          |
| ----------------- | ------------------------------------------------------------- |
| Effort プリセット | `deep` / `smart` / `normal` / `lite` / `rush`                 |
| ティア別モデル    | 各ティア（high / middle / low）のプロバイダー・モデル・推論量 |
| 推論量            | `high` / `middle` / `low` / `nothing`                         |
| コンテキスト圧縮  | ON / OFF                                                      |

### 通知

| 設定             | 既定値 |
| ---------------- | ------ |
| サウンド通知     | ON     |
| デスクトップ通知 | ON     |
| 音量             | 0.6    |

モデル設定は Gatekeeper の `app_settings` テーブルに保存され、バックエンドで 30 秒間キャッシュされます。

## 既定のモデル構成

| ティア | プロバイダー  | モデル              | 推論量 |
| ------ | ------------- | ------------------- | ------ |
| High   | `opencode-go` | `glm-5.2`           | Middle |
| Middle | `opencode-go` | `qwen-3.7-plus`     | Middle |
| Low    | `opencode-go` | `deepseek-v4-flash` | Low    |

## Effort プリセットのマトリクス

| プリセット | High ティア | Middle ティア | Low ティア |
| ---------- | ----------- | ------------- | ---------- |
| Deep       | High        | Middle        | Low        |
| Smart      | High        | High          | Low        |
| Normal     | Middle      | Middle        | Low        |
| Lite       | Middle      | Low           | Low        |
| Rush       | Low         | Low           | Low        |
