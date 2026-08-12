/**
 * ターミナル状態ストア (Issue #65)
 * 実行履歴はパネルを開閉しても保持されるよう、コンポーネント外部 (zustand) で管理する。
 */
import { create } from 'zustand';
import { api } from '../lib/api';
import { tr } from '../lib/i18n';

export interface TerminalEntry {
  command: string;
  output: string;
  error?: boolean;
}

interface TerminalState {
  entries: TerminalEntry[];
  running: boolean;
  run: (command: string) => Promise<void>;
}

/** 実行結果 (AssistantMessage) から text パーツを連結して取り出す。
 *  session.shell は AssistantMessage (parts 配列) を返すが、防御的に
 *  文字列直下・{text} 直下・オブジェクト (JSON 文字列化) にも対応する */
function extractText(output: unknown): string {
  if (typeof output === 'string') return output;
  const obj = output as { parts?: Array<{ type?: string; text?: string }>; text?: unknown };
  if (typeof obj.text === 'string') return obj.text;
  if (Array.isArray(obj.parts)) {
    return obj.parts
      .filter((p) => p && (p.type === 'text' || typeof p.text === 'string') && p.text)
      .map((p) => p.text ?? '')
      .join('\n');
  }
  if (output == null) return '';
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

export const useTerminal = create<TerminalState>((set, get) => ({
  entries: [],
  running: false,

  run: async (command: string) => {
    const value = command.trim();
    if (!value || get().running) return;
    set({ running: true });
    try {
      const res = await api.terminal.exec(value);
      set((st) => ({
        entries: [...st.entries, { command: value, output: extractText(res.output) }],
      }));
    } catch (err) {
      // 詳細はバックエンドのログまたは console.error (ネットワーク層エラー等) に残す。
      // UI には汎用メッセージ + 短い要約 (バックエンドは汎用文言のみ返すため安全) を表示し、
      // 原因切り分けを妨げない程度の情報に留める
      console.error('terminal exec failed', err);
      const detail = err instanceof Error ? err.message : String(err);
      // サロゲートペアを分割しないようコードポイント単位で 120 字に切る
      const chars = Array.from(detail);
      const brief = chars.length > 120 ? `${chars.slice(0, 120).join('')}…` : detail;
      set((st) => ({
        entries: [
          ...st.entries,
          {
            command: value,
            output: `${tr('terminal.failed')}${brief ? `: ${brief}` : ''}`,
            error: true,
          },
        ],
      }));
    } finally {
      set({ running: false });
    }
  },
}));
