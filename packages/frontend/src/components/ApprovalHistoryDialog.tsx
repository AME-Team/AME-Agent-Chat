/**
 * 承認履歴ダイアログ (要件 #2 §7.2 監査性)
 * Gatekeeper に記録された承認/拒否/ホワイトリスト化の履歴を表示。
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { api } from '../lib/api';

interface HistoryRow {
  id: string;
  type: string;
  path?: string;
  command?: string;
  description?: string;
  policy?: string;
  policy_reason?: string;
  status?: string;
  created_at?: number;
}

export function ApprovalHistoryDialog() {
  const { t } = useI18n();
  const open = useUI((s) => s.approvalHistoryOpen);
  const setOpen = useUI((s) => s.setApprovalHistoryOpen);
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(false);
    api.permissions
      .history(50)
      .then((r) => {
        if (!Array.isArray(r)) throw new Error('invalid response');
        setRows(r as HistoryRow[]);
      })
      .catch(() => {
        setRows([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white p-6 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('approval.history')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-sm text-gray-400">...</p>}
          {!loading && error && <p className="text-sm text-red-600">{t('approval.failed')}</p>}
          {!loading && !error && rows.length === 0 && (
            <p className="text-sm text-gray-400">{t('approval.historyEmpty')}</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="border-b border-gray-100 py-2 text-sm dark:border-gray-700">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={
                    r.status === 'whitelisted'
                      ? 'text-primary'
                      : r.status === 'rejected'
                        ? 'text-red-600'
                        : r.status === 'approved'
                          ? 'text-green-600'
                          : 'text-gray-500'
                  }
                >
                  {r.status ?? r.policy}
                </span>
                <span className="text-xs text-gray-400">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : ''}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-mono">{r.type}</span>
                {r.path && <span className="ml-2 break-all font-mono">{r.path}</span>}
              </div>
              {r.policy_reason && <div className="text-xs text-gray-400">{r.policy_reason}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
