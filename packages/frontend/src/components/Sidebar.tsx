/**
 * セッションサイドバー (要件 #2 §2)
 * 一覧・新規作成・切替・削除(確認)・複製・ピン留め・並び替え・タイトル編集・検索。
 */
import { ArrowDownUp, Copy, MessageSquarePlus, Pin, PinOff, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/cn';
import { useApp } from '../store/app';
import { ConfirmDialog } from './ConfirmDialog';
import type { SessionSortOrder } from '@ame-agent-chat/shared';

const SORT_OPTIONS: SessionSortOrder[] = ['updated', 'created', 'name'];

export function Sidebar() {
  const { t } = useI18n();
  const sessions = useApp((s) => s.sessions);
  const currentId = useApp((s) => s.currentId);
  const pinned = useApp((s) => s.pinned);
  const sortOrder = useApp((s) => s.sortOrder);
  const createSession = useApp((s) => s.createSession);
  const selectSession = useApp((s) => s.selectSession);
  const deleteSession = useApp((s) => s.deleteSession);
  const duplicateSession = useApp((s) => s.duplicateSession);
  const renameSession = useApp((s) => s.renameSession);
  const togglePin = useApp((s) => s.togglePin);
  const setSortOrder = useApp((s) => s.setSortOrder);

  const [query, setQuery] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = sessions.filter((s) => !q || s.title.toLowerCase().includes(q));
    const cmp =
      sortOrder === 'created'
        ? (a: AppSessionLike, b: AppSessionLike) => a.createdAt.localeCompare(b.createdAt)
        : sortOrder === 'name'
          ? (a: AppSessionLike, b: AppSessionLike) => a.title.localeCompare(b.title, 'ja')
          : (a: AppSessionLike, b: AppSessionLike) => b.updatedAt.localeCompare(a.updatedAt);
    list.sort(cmp);
    return list;
  }, [sessions, query, sortOrder]);

  const pinnedList = sorted.filter((s) => pinned.includes(s.id));
  const normalList = sorted.filter((s) => !pinned.includes(s.id));

  const startRename = (s: AppSessionLike) => {
    setEditingId(s.id);
    setEditValue(s.title);
  };

  const commitRename = async () => {
    if (editingId && editValue.trim()) {
      await renameSession(editingId, editValue.trim());
    }
    setEditingId(null);
  };

  const renderItem = (s: AppSessionLike) => {
    const isPinned = pinned.includes(s.id);
    const isEditing = editingId === s.id;
    return (
      <div
        key={s.id}
        className={cn(
          'group flex cursor-pointer items-center gap-1 rounded-md px-2 py-2 text-sm transition-colors duration-150',
          s.id === currentId
            ? 'bg-primary/10 text-primary'
            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
        )}
        onClick={() => {
          if (!isEditing) void selectSession(s.id);
        }}
        onDoubleClick={() => startRename(s)}
      >
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitRename();
              if (e.key === 'Escape') setEditingId(null);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded border border-primary bg-transparent px-1 py-0.5 outline-none"
          />
        ) : (
          <span className="flex-1 truncate">{s.title || s.id}</span>
        )}

        {!isEditing && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePin(s.id);
              }}
              aria-label={isPinned ? t('sidebar.unpin') : t('sidebar.pin')}
              className="rounded p-1 text-gray-400 hover:text-primary"
            >
              {isPinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void duplicateSession(s.id);
              }}
              aria-label={t('sidebar.duplicate')}
              className="rounded p-1 text-gray-400 hover:text-primary"
            >
              <Copy className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirmId(s.id);
              }}
              aria-label={t('sidebar.delete')}
              className="rounded p-1 text-gray-400 hover:text-red-500"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        )}
      </div>
    );
  };

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

      <div className="flex items-center gap-1 text-xs">
        <ArrowDownUp className="size-3.5 text-gray-400" />
        {SORT_OPTIONS.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setSortOrder(o)}
            className={cn(
              'rounded px-2 py-1 transition-colors duration-150',
              sortOrder === o
                ? 'bg-primary/10 text-primary'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
            )}
          >
            {t(`sidebar.sort.${o}`)}
          </button>
        ))}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="px-2 py-4 text-sm text-gray-400">{t('sidebar.empty')}</p>
        )}
        {pinnedList.map(renderItem)}
        {normalList.map(renderItem)}
      </nav>

      <ConfirmDialog
        open={confirmId !== null}
        title={t('sidebar.confirmDeleteTitle')}
        body={t('sidebar.confirmDeleteBody')}
        onCancel={() => setConfirmId(null)}
        onConfirm={() => {
          if (confirmId) void deleteSession(confirmId);
          setConfirmId(null);
        }}
      />
    </aside>
  );
}

/** AppSession の最小スライス型 (store との循環 import 回避) */
interface AppSessionLike {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}
