/**
 * メッセージ入力 (要件 #2 §3.1)
 * マルチライン・自動リサイズ・Enter 送信 / Shift+Enter 改行・トークン/文字数カウント。
 */
import { useEffect, useRef, useState } from 'react';
import { Send, Square } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApp } from '../store/app';

export function MessageInput() {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const taRef = useRef<HTMLTextAreaElement>(null);
  const busy = useApp((s) => s.busy);
  const sendMessage = useApp((s) => s.sendMessage);
  const abort = useApp((s) => s.abort);
  const currentId = useApp((s) => s.currentId);

  // 自動リサイズ (要件 #2 §3.1)
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [text]);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setText('');
    await sendMessage(value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 送信 / Shift+Enter 改行 (要件 #2 §3.1)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="border-t border-gray-100 px-4 py-4 dark:border-gray-800">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-lg border border-gray-200 p-2 focus-within:border-primary dark:border-gray-700">
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={currentId ? t('chat.placeholder') : t('chat.placeholder')}
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
