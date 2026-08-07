/**
 * スラッシュコマンド定義 (要件 #2 §6)
 */

export interface SlashCommand {
  name: string;
  aliases?: string[];
  description: string;
  /** 対応機能が未実装の場合の案内 (要件 #2 §6 備考) */
  available?: boolean;
}

/** OpenCode 準拠のスラッシュコマンド一覧 (要件 #2 §6) */
export const SLASH_COMMANDS: readonly SlashCommand[] = [
  { name: '/new', aliases: ['/clear'], description: '新規セッションを開始', available: true },
  {
    name: '/sessions',
    aliases: ['/resume', '/continue'],
    description: 'セッション一覧の表示・切替',
    available: true,
  },
  { name: '/models', description: 'モデル一覧・切替 (Effort プリセットと連携)', available: true },
  {
    name: '/compact',
    aliases: ['/summarize'],
    description: 'セッション履歴を要約圧縮',
    available: true,
  },
  { name: '/init', description: 'AGENTS.md の作成・更新', available: true },
  { name: '/export', description: 'セッションを Markdown エクスポート', available: true },
  { name: '/share', description: 'セッション共有 (Output Prompts 連携)', available: false },
  { name: '/unshare', description: '共有解除', available: false },
  { name: '/connect', description: 'プロバイダー追加 (認証連携)', available: true },
  { name: '/theme', description: 'テーマ切替 (ダークモード等)', available: true },
  { name: '/thinking', description: '思考ブロック表示の ON/OFF 切替', available: true },
  { name: '/undo', description: '元に戻す (ファイル変更含む・要 Git)', available: true },
  { name: '/redo', description: 'やり直し (/undo 後のみ有効)', available: true },
  { name: '/details', description: 'ツール実行詳細の表示切替', available: false },
  {
    name: '/help',
    description: 'ヘルプダイアログ (コマンド・ショートカット一覧)',
    available: true,
  },
] as const;

/** `@` / `!` 特殊記法 (要件 #2 §3.3) */
export const SPECIAL_NOTATIONS = {
  fileRef: '@',
  bash: '!',
} as const;
