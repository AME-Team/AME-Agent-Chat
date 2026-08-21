# フロントエンド

`packages/frontend` は、OpenCode エージェントとの対話を提供する **React PWA** です。ポート 51730 で動作します。

## 技術スタック

| 要素              | 技術                                                       |
| ----------------- | ---------------------------------------------------------- |
| UI フレームワーク | React 19                                                   |
| ビルドツール      | Vite + React プラグイン                                    |
| 言語              | TypeScript（strict・`verbatimModuleSyntax`）               |
| スタイリング      | Tailwind CSS 3（8px グリッド・`--color-primary` トークン） |
| 状態管理          | Zustand（app / ui / settings の 3 ストア）                 |
| i18n              | 独自の軽量 i18n（ja/en 辞書 + React Context）              |
| マークダウン      | react-markdown + remark-gfm + rehype-highlight             |
| PWA               | vite-plugin-pwa（Service Worker・スタンドアロン表示）      |
| アイコン          | lucide-react                                               |
| 共通型            | `@ame-agent-chat/shared`                                   |

## 画面構成

ルーティングライブラリは使わず、1 画面 + ダイアログ構成です。

- **Sidebar**: セッション一覧・検索・新規チャット・並び替え
- **Header**: テーマ / アクセントカラー / 言語切替・各種ダイアログ起動
- **ChatView**: メッセージスレッド・ツール実行アコーディオン
- **MessageInput**: 送信 / 停止 / 添付ファイル
- **ダイアログ群**: ヘルプ・承認・モデル設定・承認履歴・認証・使用量・プレビュー

## バックエンド接続

開発時は Vite のプロキシにより、`/api` リクエストがすべて Agent Core（30010）へ転送されます。ブラウザからは同一オリジンのみにアクセスします。

- 通常 API: REST（セッション / メッセージ / 設定 / 検索など）
- ストリーミング: `EventSource` で `/api/events` を購読し、SSE イベントをストアに反映

## データの永続化

| データ                                             | 保存先                       |
| -------------------------------------------------- | ---------------------------- |
| セッション・メッセージ・設定・承認履歴・使用量     | Gatekeeper（SQLite）         |
| テーマ・アクセントカラー・言語・通知設定・ピン留め | ブラウザのローカルストレージ |

## PWA

- `display: standalone` で動作し、インストール可能です (`vite-plugin-pwa`)。
- テーマカラーは `#005B99`（Trust Blue）。
- Service Worker は起動時に即登録され、更新は自動反映されます（`registerType: 'autoUpdate'`）。
- インストール導線（Issue #66）: 未インストール時は画面左下に案内バナーを表示します。
  - Chrome / Edge / Android: `beforeinstallprompt` を捕捉し「インストール」ボタンでプロンプトを発火。
  - iOS Safari: イベント非対応のため「共有 → ホーム画面に追加」手順を案内。
  - バナーはインストール済み（standalone 表示中 / localStorage 記録）・ユーザーが閉じた場合は
    表示しません（クローズ・インストール済みは 30 日で再案内可能にリセット）。
  - 既知の制約: iOS Safari では `appinstalled` イベントが発火しないため、ホーム画面に追加済みの
    ユーザーが通常の Safari タブで再訪したときに iOS 案内バナーが再度表示されることがあります
    （standalone 表示中のみ検知可能）。

## デザイン（ame-ui）

フロントエンドの UI は ame-ui の哲学に準拠しています。

- **8px グリッド**・`rounded-md/lg`・余白による構造化
- 5 つのアクセントカラー（Trust Blue / Stable Green / Grounded Orange / Sophisticated Indigo / Clarity Teal）
- ライト / ダーク / システムテーマ
- Google Fonts（Noto 系）・ja/en のフォント自動切替
- WCAG 2.1 AA 準拠（コントラスト・フォーカス表示・`aria` 属性）

このドキュメントサイト自体も同じ ame-ui 基準でデザインされています。
