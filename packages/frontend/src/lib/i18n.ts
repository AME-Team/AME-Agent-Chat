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
};

const DICTS: Record<Locale, Dict> = { ja, en };

export interface I18n {
  locale: Locale;
  t: (key: string) => string;
}

export const I18nContext = createContext<I18n>({ locale: 'ja', t: (k) => k });

export function useI18n(): I18n {
  return useContext(I18nContext);
}

export function translate(locale: Locale, key: string): string {
  return DICTS[locale][key] ?? DICTS.ja[key] ?? key;
}
