/**
 * メッセージ表示 (要件 #2 §4.1, §4.2)
 * Streaming カーソル / 担当モデル表示 / ロール区別。
 */
import { Check, ChevronDown, Copy } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/cn';
import { useUI } from '../store/ui';
import type { AppMessage } from '../store/app';
import { Markdown } from './Markdown';

export function MessageItem({ message }: { message: AppMessage }) {
  const { t } = useI18n();
  const showThinking = useUI((s) => s.showThinking);
  const [copied, setCopied] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
        )}
        aria-hidden
      >
        {isUser ? 'You' : 'AI'}
      </div>
      <div className={cn('flex max-w-[80%] flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
        {message.modelID && (
          <span className="text-xs text-gray-400">
            {message.providerID} / {message.modelID}
          </span>
        )}
        {showThinking && message.reasoning && !isUser && (
          <div className="w-full">
            <button
              type="button"
              onClick={() => setShowReasoning((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 transition-colors duration-150 hover:text-gray-600 dark:hover:text-gray-300"
              aria-expanded={showReasoning}
            >
              <ChevronDown
                className={cn('size-3 transition-transform', showReasoning && 'rotate-180')}
              />
              思考プロセス
            </button>
            {showReasoning && (
              <p className="mt-1 whitespace-pre-wrap break-words rounded-md bg-gray-50 p-2 text-xs text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
                {message.reasoning}
              </p>
            )}
          </div>
        )}
        <div
          className={cn(
            'rounded-lg px-4 py-2 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-gray-50 text-gray-900 dark:bg-gray-800 dark:text-gray-100',
          )}
        >
          {isUser ? (
            <span className="whitespace-pre-wrap break-words">
              {message.text}
              {message.streaming && <span className="ml-0.5 inline-block animate-pulse">▍</span>}
            </span>
          ) : (
            <div className="break-words">
              <Markdown>{message.text}</Markdown>
              {message.streaming && <span className="inline-block animate-pulse">▍</span>}
            </div>
          )}
        </div>
        {!message.streaming && message.text && (
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 text-xs text-gray-400 transition-colors duration-150 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? t('common.copy') : t('common.copy')}
          </button>
        )}
      </div>
    </div>
  );
}
