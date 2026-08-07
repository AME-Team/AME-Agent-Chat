/**
 * Markdown レンダリング (要件 #2 §4.2)
 *  - GFM (見出し/リスト/テーブル/引用/リンク)
 *  - コードブロック: シンタックスハイライト(rehype-highlight) + 言語ラベル + コピーボタン
 *  ame-ui-typography の見出し階層・フォント変数に準拠。
 */
import { useRef, useState } from 'react';
import MarkdownReact from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from 'lucide-react';
import { useI18n } from '../lib/i18n';

function CodeBlock({
  language,
  className,
  children,
}: {
  language?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(preRef.current?.textContent ?? '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 非セキュアコンテキスト等ではクリップボード不可 */
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-1 dark:bg-gray-800">
        <span className="text-xs text-gray-500 dark:text-gray-400">{language ?? 'text'}</span>
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 text-xs text-gray-500 transition-colors duration-150 hover:text-primary dark:text-gray-400"
          aria-label={t('code.copy')}
        >
          {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          {copied ? t('code.copied') : t('code.copy')}
        </button>
      </div>
      <pre ref={preRef} className="overflow-x-auto bg-white p-3 text-xs dark:bg-gray-900">
        <code className={className} style={{ fontFamily: 'var(--font-mono)' }}>
          {children}
        </code>
      </pre>
    </div>
  );
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md-body text-sm leading-relaxed">
      <MarkdownReact
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ className, children }) => {
            const match = /language-([\w-]+)/.exec(className ?? '');
            if (match) {
              return (
                <CodeBlock language={match[1]} className={className}>
                  {children}
                </CodeBlock>
              );
            }
            return (
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-primary dark:bg-gray-800">
                {children}
              </code>
            );
          },
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <h1 className="mb-2 mt-3 text-xl font-bold first:mt-0">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-3 text-lg font-bold first:mt-0">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-2 text-base font-semibold first:mt-0">{children}</h3>
          ),
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-gray-600 dark:text-gray-400">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-200 px-2 py-1 text-left font-semibold dark:border-gray-700">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-gray-200 px-2 py-1 dark:border-gray-700">{children}</td>
          ),
        }}
      >
        {children}
      </MarkdownReact>
    </div>
  );
}
