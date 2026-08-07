/**
 * 軽量 i18n (要件 #1 §3.1.1, #2 §9.3) — 初期対応言語 ja / en
 * 将来言語追加に耐える構造 (ame-ui-philosophy §8.1)。
 */
import { createContext, useContext } from 'react';
import type { Locale } from '@ame-agent-chat/shared';

type Dict = Record<string, string>;

const ja: Dict = {
  'app.title': 'AME Agent Chat',
  'sidebar.newChat': '新規チャット',
  'sidebar.search': 'セッションを検索',
  'sidebar.empty': 'セッションがありません',
  'chat.placeholder': 'メッセージを入力... (Enter で送信 / Shift+Enter で改行)',
  'chat.empty': '会話を始めましょう',
  'chat.send': '送信',
  'chat.stop': '停止',
  'chat.unreachable': 'Agent Core に接続できません',
  'header.help': 'ヘルプ',
  'header.theme': 'テーマ',
  'common.copy': 'コピー',
  'help.shortcuts': 'ショートカット',
  'help.commands': 'コマンド',
  'shortcut.send': '送信',
  'shortcut.newline': '改行',
  'shortcut.commandSelect': 'コマンド候補選択',
  'shortcut.invoke': 'コマンド呼び出し',
  'command.newCreated': '新規セッションを作成しました',
  'command.theme': 'テーマ: {theme}',
  'command.thinkingOn': '思考ブロック表示: ON',
  'command.thinkingOff': '思考ブロック表示: OFF',
  'command.sessions': 'サイドバーからセッションを選択できます',
  'command.models': 'モデル/ティア設定は Effort プリセット (#16/#17) で対応予定',
  'command.exported': 'Markdown エクスポートしました',
  'command.selectSession': 'セッションを選択してください',
  'command.executed': '{label} を実行しました',
  'command.executeFailed': '{label} の実行に失敗しました',
  'command.upcoming': '{label} は今後対応予定です',
  'code.copy': 'コピー',
  'code.copied': 'コピーしました',
};

const en: Dict = {
  'app.title': 'AME Agent Chat',
  'sidebar.newChat': 'New Chat',
  'sidebar.search': 'Search sessions',
  'sidebar.empty': 'No sessions',
  'chat.placeholder': 'Type a message... (Enter to send / Shift+Enter for newline)',
  'chat.empty': 'Start a conversation',
  'chat.send': 'Send',
  'chat.stop': 'Stop',
  'chat.unreachable': 'Cannot reach Agent Core',
  'header.help': 'Help',
  'header.theme': 'Theme',
  'common.copy': 'Copy',
  'help.shortcuts': 'Shortcuts',
  'help.commands': 'Commands',
  'shortcut.send': 'Send',
  'shortcut.newline': 'Newline',
  'shortcut.commandSelect': 'Select command',
  'shortcut.invoke': 'Invoke command',
  'command.newCreated': 'Created a new session',
  'command.theme': 'Theme: {theme}',
  'command.thinkingOn': 'Thinking blocks: ON',
  'command.thinkingOff': 'Thinking blocks: OFF',
  'command.sessions': 'Select a session from the sidebar',
  'command.models': 'Model/tier settings via Effort preset (#16/#17) — coming soon',
  'command.exported': 'Exported as Markdown',
  'command.selectSession': 'Please select a session',
  'command.executed': 'Ran {label}',
  'command.executeFailed': 'Failed to run {label}',
  'command.upcoming': '{label} is coming soon',
  'code.copy': 'Copy',
  'code.copied': 'Copied',
};

const DICTS: Record<Locale, Dict> = { ja, en };

export interface I18n {
  locale: Locale;
  t: (key: string, vars?: Record<string, string>) => string;
}

export const I18nContext = createContext<I18n>({ locale: 'ja', t: (k) => k });

export function useI18n(): I18n {
  return useContext(I18nContext);
}

/** プレースホルダ `{key}` を補間して翻訳 (共通ユーティリティ) */
export function translate(locale: Locale, key: string, vars?: Record<string, string>): string {
  const raw = DICTS[locale][key] ?? DICTS.ja[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') : raw;
}
