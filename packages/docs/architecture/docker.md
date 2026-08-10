# Docker 構成

Docker 構成では、**Agent Core と OpenCode Server を 1 つのコンテナに同居**させて起動します。Frontend と Gatekeeper はホストで起動します。

## 動作の分担

| コンポーネント  | 実行場所           | ポート |
| --------------- | ------------------ | ------ |
| Frontend        | ホスト             | 51730  |
| Gatekeeper      | ホスト             | 58780  |
| Agent Core      | コンテナ（公開）   | 30010  |
| OpenCode Server | コンテナ（非公開） | 40960  |

コンテナ内の OpenCode Server（40960）は **ホストに公開されません**。外部から直接アクセスできない設計です。コンテナから Gatekeeper へは `host.docker.internal:58780` 経由でアクセスします。

## イメージの特徴

| 項目               | 内容                                              |
| ------------------ | ------------------------------------------------- |
| ベース             | `node:24-bookworm-slim`                           |
| ユーザー           | `node`（uid 1000、非 root の最小権限）            |
| プロセスマネージャ | supervisord（OpenCode + Agent Core を自動再起動） |
| OpenCode           | `opencode-ai@1.18.14` をグローバルインストール    |
| ワークスペース     | ホストのディレクトリを `/workspace` に bind mount |
| ヘルスチェック     | `http://localhost:30010/health`                   |

## docker-compose.yml

```yaml
services:
  agent:
    build: ./docker
    container_name: ame-agent
    volumes:
      - ${WORKSPACE_DIR:-.}:/workspace # 既定はカレントディレクトリ
    ports:
      - '30010:30010' # Agent Core のみ公開
    extra_hosts:
      - host.docker.internal:host-gateway # Linux で Gatekeeper へアクセスするため
    restart: unless-stopped
```

## 起動 / 停止

```bash
# 起動（ワークスペースを指定）
WORKSPACE_DIR=/path/to/workspace docker compose up -d --build

# ログ確認
docker compose logs -f agent

# 停止
docker compose down
```

### `pnpm start` での利用

`pnpm start` はこの Docker 構成を自動的に利用します。

1. Docker の起動確認（Windows / macOS は Docker Desktop を自動起動）
2. Gatekeeper をホストで起動
3. Frontend をホストで起動
4. ヘルスチェック（Gatekeeper 58780 / Frontend 51730）
5. `docker compose up -d --build`（`WORKSPACE_DIR` はリポジトリルート）
6. Agent Core（30010）のヘルスチェック後、ブラウザを自動オープン

停止は `pnpm stop` で、コンテナ停止 + ホストプロセスの終了まで行います。

## Linux ホストでの注意

コンテナは `node`（uid 1000）で実行されるため、Linux ホストでは bind mount するワークスペースディレクトリの所有 uid を 1000 に合わせてください。

```bash
sudo chown -R 1000:1000 /path/to/workspace
```

Windows / macOS の Docker Desktop では自動解決されるため不要です。

## 環境変数

| 変数                | 既定値                              | 説明                                  |
| ------------------- | ----------------------------------- | ------------------------------------- |
| `WORKSPACE_DIR`     | カレントディレクトリ                | bind mount するホストのワークスペース |
| `CORS_ORIGIN`       | `http://localhost:51730`            | Agent Core が許可するオリジン         |
| `OPENCODE_BASE_URL` | `http://localhost:40960`            | コンテナ内 OpenCode の URL            |
| `GATEKEEPER_URL`    | `http://host.docker.internal:58780` | Gatekeeper の URL                     |
