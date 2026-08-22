# インストール

## 前提条件

AME Agent Chat を動作させるには以下の環境が必要です。

| 必須項目 | 要件                                                      |
| -------- | --------------------------------------------------------- |
| OS       | Windows 10/11、macOS、Linux（主要ディストリビューション） |
| Node.js  | **24 以上**（`node -v` で確認）                           |
| pnpm     | **11.20.0 以上**（リポジトリの `packageManager` と一致）  |
| Docker   | Docker コンテナ構成（`pnpm start`）を利用する場合に必要   |

### Node.js と pnpm の確認

```bash
node -v
# v24.x.x 以上が必要

pnpm -v
# 11.20.0 以上が必要
```

pnpm が未導入の場合は以下で導入してください。

```bash
npm install -g pnpm
```

::: tip
リポジトリの `.nvmrc` に推奨 Node.js バージョンが記載されています。`nvm` を利用している場合は
`nvm use` で合わせられます。
:::

## リリースパッケージ（GitHub Releases）からインストール

コードをダウンロードして使うだけの場合は、GitHub リリースのアーカイブが最も簡単です。

1. [Releases](https://github.com/AME-Team/AME-Agent-Chat/releases) ページから任意のバージョンの
   **ソースアーカイブ** をダウンロードします（`ame-agent-chat-<version>.zip` または `.tar.gz`）。
   - バージョンタグは `v1.2.3` 形式です。最新版は一番上にあります。
2. ダウンロードしたアーカイブを展開します。
3. 展開したディレクトリで依存関係をインストールし、起動します。

::: code-group

```bash [zip]
unzip ame-agent-chat-1.2.3.zip
cd ame-agent-chat-1.2.3
pnpm install
pnpm start
```

```bash [tar.gz]
tar -xzf ame-agent-chat-1.2.3.tar.gz
cd ame-agent-chat-1.2.3
pnpm install
pnpm start
```

:::

::: tip

- アーカイブにはソース一式と `pnpm-lock.yaml` が同梱されているため、依存関係を再現性のある状態でインストールできます。
- `pnpm start`（ワンコマンド起動）には Docker が必要です。Docker を使わない場合は `pnpm dev`（ホスト起動）を使用してください。
- 起動方法の詳細は [クイックスタート](/guide/quickstart) を参照してください。
- 開発者向けの git clone 方式は [リポジトリの取得](#リポジトリの取得) を参照してください。
  :::

### Docker イメージ（GHCR）から起動

リリース時には Docker イメージも `ghcr.io/ame-team/ame-agent-chat` に公開されます。コンテナで
Agent Core + OpenCode を起動する場合は、タグを指定して `docker compose` で利用できます。

## リポジトリの取得（開発者向け）

```bash
git clone https://github.com/AME-Team/AME-Agent-Chat.git
cd AME-Agent-Chat
```

## 依存関係のインストール

```bash
pnpm install
```

モノレポ内の全パッケージ（frontend / agent-core / gatekeeper / shared / docs）の依存関係が一括でインストールされます。

## 起動方法の選択

セットアップ後の起動方法は、用途に応じて次の 2 つから選べます。

- **ローカル開発モード**: `pnpm dev` — 全パッケージをホストで並列起動（[クイックスタート](/guide/quickstart)）
- **ワンコマンド起動**: `pnpm start` — Docker コンテナ（Agent Core + OpenCode）+ Gatekeeper + Frontend をまとめて起動

詳しい手順は [クイックスタート](/guide/quickstart) を参照してください。

## 動作確認

### ビルドと静的チェック

```bash
pnpm typecheck    # 全パッケージの型チェック
pnpm lint         # ESLint
pnpm format:check # Prettier 整形チェック
pnpm build        # 全パッケージのビルド
```

### 品質ゲート（開発者向け）

このリポジトリには AI レビュー（Dual-Gate）が組み込まれています。

- **Gate 1**: pre-commit 時に静的解析・シークレットスキャン・AI レビューが実行される
- **Gate 2**: PR で `/request-review` コメントを投稿すると AI レビューが実行される

詳細はリポジトリの `AGENTS.md` と `.ame-review/` を参照してください。

## トラブルシューティング

### `pnpm install` が失敗する

- Node.js が 24 以上であることを確認してください。
- pnpm バージョンを `11.20.0` 以上に合わせてください（`corepack enable` も有効）。

### Docker が見つからない

- Docker Desktop（Windows / macOS）または Docker Engine（Linux）を起動してください。
- コンテナ構成を利用しない場合は `pnpm dev`（ホスト起動）を利用できます。

### ポートが競合する

- 既定のポート（[ポート一覧](/reference/ports)）が使用中の場合は、関連プロセスを終了するか環境変数で変更してください。
