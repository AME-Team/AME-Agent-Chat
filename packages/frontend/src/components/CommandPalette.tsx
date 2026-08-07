/**
 * スラッシュコマンドサジェスト (要件 #2 §6 コマンドパレット・サジェスト付き)
 * 入力が `/` で始まる場合に候補を表示。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { SLASH_COMMANDS } from '../lib/commands';
import { cn } from '../lib/cn';

export function CommandPalette({
  query,
  onPick,
}: {
  query: string;
  onPick: (name: string) => void;
}) {
  const matches = useMemo(() => {
    const q = query.toLowerCase();
    return SLASH_COMMANDS.filter(
      (c) => c.name.startsWith(q) || c.aliases?.some((a) => a.startsWith(q)),
    ).slice(0, 8);
  }, [query]);

  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, matches.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === 'Enter' && matches[active]) {
        e.preventDefault();
        onPick(matches[active].name);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [matches, active, onPick]);

  if (matches.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 mb-2 w-72 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800"
      role="listbox"
    >
      {matches.map((c, i) => (
        <button
          key={c.name}
          type="button"
          role="option"
          aria-selected={i === active}
          onMouseEnter={() => setActive(i)}
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
