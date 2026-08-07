/**
 * チャット表示領域 (要件 #2 §4.3)
 * 自動スクロール追従 + 上スクロール時の一時停止 + 「最新へ」ボタン。
 */
import { useEffect, useRef, useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApp } from '../store/app';
import { MessageItem } from './MessageItem';
import { ProcessAccordion } from './ProcessAccordion';

export function ChatView() {
  const { t } = useI18n();
  const messages = useApp((s) => s.messages);
  const currentId = useApp((s) => s.currentId);
  const reachable = useApp((s) => s.reachable);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // 自動スクロール (追従中のみ) — 要件 #2 §4.3
  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, atBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 80);
  };

  return (
    <div className="relative flex flex-1 flex-col">
      <ProcessAccordion />
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
            <p className="text-lg">{t('chat.empty')}</p>
            {!reachable && <p className="text-sm">{t('chat.unreachable')}</p>}
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            {messages.map((m) => (
              <MessageItem key={m.id} message={m} />
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!atBottom && currentId && (
        <button
          type="button"
          onClick={() => {
            setAtBottom(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          aria-label="latest"
          className="absolute bottom-4 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors duration-150 hover:text-primary dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <ArrowDown className="size-4" />
        </button>
      )}
    </div>
  );
}
