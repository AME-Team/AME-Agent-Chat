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

/** 実行結果 (AssistantMessage) から text パーツを連結して取り出す */
function extractText(output: unknown): string {
  const parts = (output as { parts?: Array<{ type?: string; text?: string }> })?.parts;
  if (!Array.isArray(parts)) return String(output ?? '');
  return parts
    .filter((p) => p && (p.type === 'text' || typeof p.text === 'string') && p.text)
    .map((p) => p.text ?? '')
    .join('\n');
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
      set((st) => ({
        entries: [
          ...st.entries,
          { command: value, output: `${tr('terminal.failed')}: ${String(err)}`, error: true },
        ],
      }));
    } finally {
      set({ running: false });
    }
  },
}));
