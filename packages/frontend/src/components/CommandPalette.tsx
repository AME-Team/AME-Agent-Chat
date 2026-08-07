/**
 * スラッシュコマンドサジェスト (要件 #2 §6)
 * 表示・マウス操作のみ担当。キーボード操作は親(MessageInput)で制御(二重実行回避)。
 */
import { cn } from '../lib/cn';
import type { SlashCommand } from '@ame-agent-chat/shared';

export function CommandPalette({
  matches,
  active,
  onActiveChange,
  onPick,
}: {
  matches: SlashCommand[];
  active: number;
  onActiveChange: (i: number) => void;
  onPick: (name: string) => void;
}) {
  if (matches.length === 0) return null;

  return (
    <div
      className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
      role="listbox"
    >
      {matches.map((c, i) => (
        <button
          key={c.name}
          type="button"
          role="option"
          aria-selected={i === active}
          onMouseEnter={() => onActiveChange(i)}
          onClick={() => onPick(c.name)}
          className={cn(
            'flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors duration-150',
            i === active ? 'bg-primary/10' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50',
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {c.name}
            {c.aliases && <span className="text-xs text-gray-400">{c.aliases.join(', ')}</span>}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{c.description}</span>
        </button>
      ))}
    </div>
  );
}
