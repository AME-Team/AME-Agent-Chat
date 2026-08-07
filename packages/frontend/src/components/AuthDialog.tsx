/**
 * プロバイダー認証ダイアログ (要件 #1 §3.1.5)
 * プロバイダー一覧・認証状態を表示し、OpenCode の Auth Login を GUI から実行。
 */
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { api } from '../lib/api';

interface ProviderInfo {
  id: string;
  name?: string;
  authenticated?: boolean;
}

interface AuthState {
  providers: ProviderInfo[];
  authMethods: Record<string, unknown[]>;
}

export function AuthDialog() {
  const { t } = useI18n();
  const open = useUI((s) => s.authOpen);
  const setOpen = useUI((s) => s.setAuthOpen);
  const pushToast = useUI((s) => s.pushToast);
  const [data, setData] = useState<AuthState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setBusy(true);
    api.auth
      .providers()
      .then((r) =>
        setData({ providers: r.providers as ProviderInfo[], authMethods: r.authMethods }),
      )
      .catch(() => setData(null))
      .finally(() => setBusy(false));
  }, [open]);

  if (!open) return null;

  const login = async (provider: string) => {
    setBusy(true);
    try {
      const res = (await api.auth.login(provider)) as {
        url?: string;
        verification_uri?: string;
      } | null;
      const url = res?.url ?? res?.verification_uri;
      if (url) window.open(url, '_blank', 'noopener');
      pushToast(t('auth.loginStarted'), 'success');
      // 認証完了を反映 (短い待機後に再取得)
      setTimeout(async () => {
        try {
          const r = await api.auth.providers();
          setData({ providers: r.providers as ProviderInfo[], authMethods: r.authMethods });
        } catch {
          /* keep current */
        }
        setBusy(false);
      }, 3000);
    } catch {
      pushToast(t('auth.loginFailed'), 'error');
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('auth.title')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>

        {busy && <p className="text-sm text-gray-400">...</p>}
        {!busy && !data && <p className="text-sm text-gray-400">{t('auth.empty')}</p>}
        {!busy &&
          data &&
          data.providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between border-b border-gray-100 py-2 text-sm dark:border-gray-700"
            >
              <div className="flex flex-col">
                <span className="font-medium">{p.name ?? p.id}</span>
                <span className="text-xs text-gray-400">
                  {p.authenticated
                    ? t('auth.authenticated')
                    : `${(data.authMethods[p.id] ?? []).length} ${t('auth.methods')}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void login(p.id)}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90"
              >
                {t('auth.login')}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
