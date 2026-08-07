/**
 * 使用量ダイアログ (要件 #1 §3.2.5 / #27)
 * プロバイダー×モデル別のトークン使用実績・コストを表示。
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { api } from '../lib/api';

interface UsageRow {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export function UsageDialog() {
  const { t } = useI18n();
  const open = useUI((s) => s.usageOpen);
  const setOpen = useUI((s) => s.setUsageOpen);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api.usage
      .get()
      .then((r) => setRows(Array.isArray(r) ? (r as UsageRow[]) : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const totalCost = rows.reduce((s, r) => s + r.cost, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white p-6 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('usage.title')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>

        {loading && <p className="text-sm text-gray-400">...</p>}
        {!loading && rows.length === 0 && (
          <p className="text-sm text-gray-400">{t('usage.empty')}</p>
        )}
        {!loading && rows.length > 0 && (
          <div className="flex-1 space-y-2 overflow-y-auto">
            {rows.map((r) => (
              <div
                key={`${r.provider}-${r.model}`}
                className="rounded-md border border-gray-200 p-3 text-sm dark:border-gray-700"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {r.provider} / {r.model}
                  </span>
                  <span className="font-mono text-xs">${r.cost.toFixed(4)}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  in: {r.inputTokens.toLocaleString()} · out: {r.outputTokens.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
        {!loading && rows.length > 0 && (
          <p className="mt-3 text-right text-sm text-gray-600 dark:text-gray-300">
            {t('usage.total')}: <span className="font-mono">${totalCost.toFixed(4)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
