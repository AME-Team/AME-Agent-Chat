/**
 * アプリとしてインストール案内バナー (Issue #66)
 * Chrome/Edge/Android はインストールプロンプトを発火、iOS はホーム画面追加手順を表示。
 * インストール済み (standalone) / ユーザーが閉じた場合は非表示 (useInstallPrompt が判定)。
 */
import { Download, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useInstallPrompt } from '../lib/pwa';

export function InstallPrompt() {
  const { t } = useI18n();
  const { show, isIOS, promptInstall, dismiss } = useInstallPrompt();

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label={t('pwa.install')}
      className="fixed bottom-4 left-4 z-40 flex max-w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-lg bg-white p-4 shadow-lg ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700"
    >
      <Download className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{t('pwa.install')}</p>
        <p className="mt-1 whitespace-pre-line text-xs text-gray-500 dark:text-gray-400">
          {isIOS ? t('pwa.iosSteps') : t('pwa.benefits')}
        </p>
        {!isIOS && (
          <button
            type="button"
            onClick={() => void promptInstall()}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <Download className="size-4" />
            {t('pwa.installAction')}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.close')}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
