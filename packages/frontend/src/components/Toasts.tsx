/**
 * トースト通知 (要件 #2 §9.2)
 */
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { useUI } from '../store/ui';
import { cn } from '../lib/cn';

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          onClick={() => dismiss(t.id)}
          className={cn(
            'pointer-events-auto flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white shadow-md transition-opacity duration-300',
            t.tone === 'success' && 'bg-green-600',
            t.tone === 'error' && 'bg-red-600',
            t.tone === 'info' && 'bg-gray-800 dark:bg-gray-700',
          )}
        >
          {t.tone === 'success' && <CheckCircle2 className="size-4 shrink-0" />}
          {t.tone === 'error' && <XCircle className="size-4 shrink-0" />}
          {t.tone === 'info' && <Info className="size-4 shrink-0" />}
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  );
}
