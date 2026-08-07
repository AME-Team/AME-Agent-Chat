/**
 * 削除確認ダイアログ (要件 #2 §2.1 セッション削除時の復元確認)
 * Escape で閉じ・aria-labelledby/describedby・初期フォーカス (WCAG 2.1 AA)。
 */
import { useEffect, useRef } from 'react';
import { useI18n } from '../lib/i18n';

const TITLE_ID = 'confirm-dialog-title';
const BODY_ID = 'confirm-dialog-body';

export function ConfirmDialog({
  open,
  title,
  body,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-6 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal
        aria-labelledby={TITLE_ID}
        aria-describedby={BODY_ID}
      >
        <h2 id={TITLE_ID} className="mb-2 text-base font-bold">
          {title}
        </h2>
        {body && (
          <p id={BODY_ID} className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            {body}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 transition-colors duration-150 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {t('common.cancel')}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white transition-colors duration-150 hover:opacity-90"
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
