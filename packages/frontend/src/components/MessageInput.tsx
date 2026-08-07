/**
 * メッセージ入力 (要件 #2 §3.1)
 * マルチライン・自動リサイズ・Enter 送信 / Shift+Enter 改行・文字数カウント。
 * スラッシュコマンド(#2 §6)を入力で検知し CommandPalette を表示(キー操作は本コンポーネントで集約)。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApp } from '../store/app';
import { CommandPalette } from './CommandPalette';
import { executeCommand, matchCommands, parseCommand } from '../lib/commands';

export function MessageInput() {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busy = useApp((s) => s.busy);
  const sendMessage = useApp((s) => s.sendMessage);
  const abort = useApp((s) => s.abort);

  // 自動リサイズ (要件 #2 §3.1)
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [text]);

  const paletteQuery = text.trim().startsWith('/') && !text.trim().includes(' ') ? text.trim() : '';
  const matches = useMemo(() => matchCommands(paletteQuery), [paletteQuery]);
  const paletteVisible = matches.length > 0;

  useEffect(() => setActive(0), [paletteQuery]);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setText('');
    const cmd = parseCommand(value);
    if (cmd) {
      await executeCommand(cmd.name, cmd.args);
    } else {
      await sendMessage(value);
    }
  };

  const pickCommand = (name: string) => setText(`${name} `);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // パレット表示中のキー操作は本コンポーネントで集約(二重実行回避)
    if (paletteVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, matches.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        pickCommand(matches[active].name);
        return;
      }
    }
    // Enter 送信 / Shift+Enter 改行 (要件 #2 §3.1)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="relative border-t border-gray-100 px-4 py-4 dark:border-gray-800">
      {paletteVisible && (
        <CommandPalette
          matches={matches}
          active={active}
          onActiveChange={setActive}
          onPick={pickCommand}
        />
      )}
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-lg border border-gray-200 p-2 focus-within:border-primary dark:border-gray-700">
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t('chat.placeholder')}
          className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-gray-400"
        />
        {busy ? (
          <button
            type="button"
            onClick={() => void abort()}
            aria-label={t('chat.stop')}
            className="flex size-8 items-center justify-center rounded-md bg-gray-200 text-gray-700 transition-colors duration-150 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            <Square className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!text.trim()}
            aria-label={t('chat.send')}
            className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors duration-150 hover:opacity-90 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        )}
      </div>
      <div className="mx-auto mt-1 flex max-w-3xl justify-end">
        <span className="text-xs text-gray-400">{text.length}</span>
      </div>
    </div>
  );
}
