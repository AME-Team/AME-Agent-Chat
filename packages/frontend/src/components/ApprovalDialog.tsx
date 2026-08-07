/**
 * 承認ダイアログ (要件 #2 §7.2)
 * 操作内容(パス・コマンド・影響範囲)を明示し、承認 / 拒否 / ホワイトリスト化を選択。
 * ポリシーで禁止(Execute)の場合は承認ボタンを無効化。
 */
import { AlertTriangle, Check, ShieldAlert, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { api } from '../lib/api';

export function ApprovalDialog() {
  const { t } = useI18n();
  const p = useUI((s) => s.pendingPermission);
  const setPending = useUI((s) => s.setPendingPermission);
  const pushToast = useUI((s) => s.pushToast);

  if (!p) return null;

  const deny = p.type === 'execute';
  const decide = async (approved: boolean, whitelist: boolean) => {
    try {
      await api.permissions.decide(p.id, approved, whitelist);
      pushToast(
        approved
          ? whitelist
            ? t('approval.whitelisted')
            : t('approval.approved')
          : t('approval.rejected'),
        approved ? 'success' : 'error',
      );
    } catch {
      pushToast(t('approval.failed'), 'error');
    }
    setPending(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-lg bg-white p-6 dark:bg-gray-800"
        role="dialog"
        aria-modal
        aria-label="approval"
      >
        <div className="mb-3 flex items-center gap-2">
          {deny ? (
            <ShieldAlert className="size-5 text-red-600" />
          ) : (
            <AlertTriangle className="size-5 text-primary" />
          )}
          <h2 className="text-base font-bold">{t('approval.title')}</h2>
        </div>

        <dl className="mb-4 space-y-2 text-sm">
          {p.title && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-gray-400">{t('approval.action')}</dt>
              <dd className="break-all">{p.title}</dd>
            </div>
          )}
          {p.type && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-gray-400">{t('approval.type')}</dt>
              <dd className="font-mono">{p.type}</dd>
            </div>
          )}
          {p.path && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-gray-400">{t('approval.path')}</dt>
              <dd className="break-all font-mono">{p.path}</dd>
            </div>
          )}
          {p.command && (
            <div className="flex gap-2">
              <dt className="shrink-0 text-gray-400">{t('approval.command')}</dt>
              <dd className="break-all font-mono">{p.command}</dd>
            </div>
          )}
        </dl>

        {deny && <p className="mb-4 text-sm text-red-600">{t('approval.deniedByPolicy')}</p>}

        <div className="flex justify-end gap-2">
          {!deny && (
            <button
              type="button"
              onClick={() => void decide(true, true)}
              className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              <Check className="size-4" />
              {t('approval.alwaysAllow')}
            </button>
          )}
          <button
            type="button"
            onClick={() => void decide(false, false)}
            className="flex items-center gap-1 rounded-md bg-gray-200 px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            <X className="size-4" />
            {t('approval.reject')}
          </button>
          {!deny && (
            <button
              type="button"
              onClick={() => void decide(true, false)}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors duration-150 hover:opacity-90"
            >
              <Check className="size-4" />
              {t('approval.approve')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
