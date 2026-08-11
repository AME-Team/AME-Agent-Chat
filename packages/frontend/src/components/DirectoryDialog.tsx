/**
 * カレントディレクトリ選択ダイアログ (Issue #56)
 * 現在のワークスペースディレクトリの確認と、プロジェクト一覧 / 任意パスからの選択。
 */
import { useEffect, useState } from 'react';
import { Folder, FolderOpen, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { useApp } from '../store/app';
import { api } from '../lib/api';

export function DirectoryDialog() {
  const { t } = useI18n();
  const open = useUI((s) => s.cwdOpen);
  const setOpen = useUI((s) => s.setCwdOpen);
  const pushToast = useUI((s) => s.pushToast);
  const currentDirectory = useApp((s) => s.currentDirectory);
  const setCurrentDirectory = useApp((s) => s.setCurrentDirectory);
  const [projects, setProjects] = useState<string[]>([]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    api.cwd
      .get()
      .then((res) => {
        setProjects(Array.isArray(res.projects) ? res.projects : []);
        // falsy のときも毎回リセット (前回のキャンセル入力を残さない)
        setCustom(res.current ?? '');
      })
      .catch(() => setProjects([]))
      .finally(() => setBusy(false));
  }, [open]);

  if (!open) return null;

  const select = async (directory: string) => {
    if (!directory.trim()) return;
    setBusy(true);
    try {
      await setCurrentDirectory(directory.trim());
      pushToast(t('cwd.selected'), 'success');
      setOpen(false);
    } catch {
      pushToast(t('cwd.selectFailed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('cwd.title')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* 現在のディレクトリ */}
        <div className="mb-6 flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-700/50">
          <FolderOpen className="size-4 shrink-0 text-gray-400" />
          <span className="truncate font-mono text-gray-700 dark:text-gray-300">
            {currentDirectory || t('cwd.empty')}
          </span>
        </div>

        {busy && <p className="text-sm text-gray-400">...</p>}

        {/* プロジェクト一覧 */}
        {!busy && projects.length > 0 && (
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
              {t('cwd.projects')}
            </h3>
            <div className="space-y-1">
              {projects.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void select(p)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-700 transition-colors duration-150 hover:bg-primary/10 hover:text-primary dark:text-gray-300"
                >
                  <Folder className="size-4 shrink-0 text-gray-400" />
                  <span className="truncate font-mono">{p}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 任意パス入力 */}
        <div className="mb-6">
          <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('cwd.custom')}
          </label>
          <div className="flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void select(custom);
              }}
              placeholder="/path/to/workspace"
              className="min-w-0 flex-1 rounded border border-gray-200 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-primary dark:border-gray-600"
            />
            <button
              type="button"
              onClick={() => void select(custom)}
              disabled={busy || !custom.trim()}
              className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90 disabled:opacity-40"
            >
              {t('common.select')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
