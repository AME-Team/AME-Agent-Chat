/**
 * セッションサイドバー (要件 #2 §2)
 * 一覧・新規作成・切替・削除。
 */
import { MessageSquarePlus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/cn';
import { useApp } from '../store/app';

export function Sidebar() {
  const { t } = useI18n();
  const sessions = useApp((s) => s.sessions);
  const currentId = useApp((s) => s.currentId);
  const createSession = useApp((s) => s.createSession);
  const selectSession = useApp((s) => s.selectSession);
  const deleteSession = useApp((s) => s.deleteSession);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return q ? list.filter((s) => s.title.toLowerCase().includes(q)) : list;
  }, [sessions, query]);

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 p-4">
      <button
        type="button"
        onClick={() => void createSession()}
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90"
      >
        <MessageSquarePlus className="size-4" />
        {t('sidebar.newChat')}
      </button>

      <div className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700">
        <Search className="size-4 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('sidebar.search')}
          className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="px-2 py-4 text-sm text-gray-400">{t('sidebar.empty')}</p>
        )}
        {filtered.map((s) => (
          <div
            key={s.id}
            className={cn(
              'group flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150',
              s.id === currentId
                ? 'bg-primary/10 text-primary'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
            )}
            onClick={() => void selectSession(s.id)}
          >
            <span className="truncate">{s.title || s.id}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void deleteSession(s.id);
              }}
              aria-label="delete"
              className="shrink-0 text-gray-400 opacity-0 transition-opacity duration-150 hover:text-red-500 group-hover:opacity-100"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </nav>
    </aside>
  );
}
