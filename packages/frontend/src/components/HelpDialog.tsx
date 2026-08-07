/**
 * ヘルプダイアログ (要件 #2 §6 /help, §9.1 チートシート)
 * コマンド一覧 + ショートカットキーを表示。
 */
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { SLASH_COMMANDS } from '../lib/commands';

const TITLE_ID = 'help-dialog-title';

export function HelpDialog() {
  const { t } = useI18n();
  const open = useUI((s) => s.helpOpen);
  const setOpen = useUI((s) => s.setHelpOpen);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape で閉じる + 初期フォーカス (WCAG 2.1 AA: AGENTS.md §)
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  const shortcuts: Array<{ key: string; desc: string }> = [
    { key: 'Enter', desc: t('shortcut.send') },
    { key: 'Shift + Enter', desc: t('shortcut.newline') },
    { key: '↑ / ↓', desc: t('shortcut.commandSelect') },
    { key: '/', desc: t('shortcut.invoke') },
  ];

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-labelledby={TITLE_ID}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={TITLE_ID} className="text-lg font-bold">
            {t('header.help')}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('help.shortcuts')}
        </h3>
        <ul className="mb-6 space-y-1">
          {shortcuts.map((s) => (
            <li key={s.key} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">{s.desc}</span>
              <kbd className="rounded border border-gray-200 px-2 py-0.5 text-xs dark:border-gray-600">
                {s.key}
              </kbd>
            </li>
          ))}
        </ul>

        <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('help.commands')}
        </h3>
        <ul className="space-y-1">
          {SLASH_COMMANDS.map((c) => (
            <li key={c.name} className="flex items-start gap-2 text-sm">
              <span className="shrink-0 font-mono text-primary">{c.name}</span>
              <span className="text-gray-600 dark:text-gray-400">{c.description}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
