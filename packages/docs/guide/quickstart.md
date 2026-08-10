# クイックスタート

インストールが完了したら、次のいずれかの方法で起動します。

## 方法 A: ローカル開発モード（推奨）

全パッケージ（Frontend / Agent Core / Gatekeeper）をホストで並列起動します。
`opencode serve` が未起動の場合は自動的に起動します。

```bash
pnpm dev
```

起動が完了すると、以下の URL にアクセスできます。

| サービス                | URL                    |
| ----------------------- | ---------------------- |
| Frontend（チャット UI） | http://localhost:51730 |
| Agent Core（BFF）       | http://localhost:30010 |
| Gatekeeper              | http://localhost:58780 |

ブラウザで **http://localhost:51730** を開き、「新しいチャット」から会話を始めます。

::: tip
`pnpm dev` は OpenCode Server（40960）が未起動の場合のみ自動起動します。
**自動起動した場合のみ**、dev 終了時に自動停止されます。既に `opencode serve` が起動している場合はそれを利用します。
:::

## 方法 B: ワンコマンド起動（Docker）

Agent Core と OpenCode Server を Docker コンテナで同居起動し、Frontend と Gatekeeper はホストで起動する構成です。ブラウザも自動で開きます。

```bash
pnpm start
```

停止は以下のコマンドです。

```bash
pnpm stop
```

::: warning Linux ユーザーの注意
コンテナは `node`（uid 1000）ユーザーで実行されます。Linux ホストではワークスペースディレクトリの所有 uid を 1000 に合わせてください。

```bash
sudo chown -R 1000:1000 <ワークスペースディレクトリ>
```

Windows / macOS の Docker Desktop では自動解決されるため不要です。
:::

## 方法 C: Docker を手動で操作する

Docker Compose を直接操作して、コンテナだけを起動・停止することもできます。

```bash
# 起動（ワークスペースを /workspace に bind mount。既定はカレントディレクトリ）
WORKSPACE_DIR=$(pwd) docker compose up -d --build

# ログを確認
docker compose logs -f agent

# 停止
docker compose down
```

この構成ではコンテナ内で Agent Core（30010・公開）と OpenCode Server（40960・非公開）が同居します。Frontend（51730）と Gatekeeper（58780）はホスト側で別途起動してください。

## 最初の会話

1. チャット画面左下の入力欄にメッセージを入力して **Enter** で送信します。
2. エージェントがタスクを解析し、適切なモデル（Tier）に自動ルーティングされます。
3. ファイル書き込みなどの操作が必要な場合は **承認ダイアログ** が表示されます。内容を確認して「承認」または「拒否」を選択します。
4. 回答はストリーミングでリアルタイムに表示されます。

より詳しい使い方は [チャット機能](/guide/chat) を参照してください。

## 次のステップ

- [チャット機能](/guide/chat) — 入力の特殊記法・添付ファイル・編集など
- [スラッシュコマンド](/guide/commands) — `/` で始まる便利コマンド
- [承認フロー](/guide/approvals) — ポリシー判定と承認の仕組み
- [設定](/guide/settings) — モデル・Tier・テーマのカスタマイズ
