/**
 * プロセス可視化アコーディオン (要件 #1 §3.1.4, #2 §8)
 * Agent 自律ループ中のツール実行イベントを表示。`/details` またはクリックで展開。
 */
import { ChevronDown, Wrench } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../lib/cn';
import { useApp, type ToolEvent } from '../store/app';
import { useUI } from '../store/ui';

function ToolRow({ tool }: { tool: ToolEvent }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 py-1 text-xs dark:border-gray-700">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-gray-600 dark:text-gray-300"
      >
        <ChevronDown className={cn('size-3 shrink-0 transition-transform', open && 'rotate-180')} />
        <span className="font-mono">{tool.name}</span>
        <span className="text-gray-400">{tool.state}</span>
      </button>
      {open && tool.input && (
        <pre className="mt-1 overflow-x-auto rounded bg-gray-50 p-2 text-gray-500 dark:bg-gray-900/50 dark:text-gray-400">
          {tool.input}
        </pre>
      )}
    </div>
  );
}

export function ProcessAccordion() {
  const tools = useApp((s) => s.tools);
  const showDetails = useUI((s) => s.showDetails);
  const [open, setOpen] = useState(false);
  const expanded = open || showDetails;

  if (tools.length === 0) return null;

  return (
    <div className="mx-auto mt-2 w-full max-w-3xl rounded-md border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between text-sm text-gray-600 dark:text-gray-300"
      >
        <span className="flex items-center gap-2">
          <Wrench className="size-3.5" />
          ツール実行 ({tools.length})
        </span>
        <ChevronDown className={cn('size-4 transition-transform', expanded && 'rotate-180')} />
      </button>
      {expanded && (
        <div className="mt-2 max-h-48 overflow-y-auto">
          {tools.map((t, i) => (
            <ToolRow key={`${t.id}-${i}`} tool={t} />
          ))}
        </div>
      )}
    </div>
  );
}
