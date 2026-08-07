/**
 * ヘッダー (要件 #2 §9.1, §9.3)
 * テーマ切替・1ポイントカラー切替・言語切替の基本操作。
 */
import { HelpCircle, Monitor, Moon, Settings, Sun } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/cn';
import { useApp } from '../store/app';
import { useUI } from '../store/ui';
import type { AccentColor, Theme } from '@ame-agent-chat/shared';

const ACCENT_SWATCH: Record<AccentColor, string> = {
  'trust-blue': '#005B99',
  'stable-green': '#2D6A4F',
  'grounded-orange': '#C2410C',
  'sophisticated-indigo': '#4338CA',
  'clarity-teal': '#0F766E',
};

const ACCENTS: AccentColor[] = [
  'trust-blue',
  'stable-green',
  'grounded-orange',
  'sophisticated-indigo',
  'clarity-teal',
];

export function Header() {
  const { t } = useI18n();
  const theme = useApp((s) => s.theme);
  const setTheme = useApp((s) => s.setTheme);
  const accent = useApp((s) => s.accent);
  const setAccent = useApp((s) => s.setAccent);
  const locale = useApp((s) => s.locale);
  const setLocale = useApp((s) => s.setLocale);
  const setSettingsOpen = useUI((s) => s.setSettingsOpen);

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-4">
      <h1 className="text-base font-bold">{t('app.title')}</h1>
      <div className="flex items-center gap-2">
        {/* 1ポイントカラー切替 (ame-ui-philosophy §4.2) */}
        <div className="flex items-center gap-1" role="group" aria-label="accent">
          {ACCENTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAccent(a)}
              aria-label={a}
              className={cn(
                'size-4 rounded-full border transition-transform duration-150 hover:scale-110',
                accent === a
                  ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-offset-gray-900'
                  : 'border-gray-200',
              )}
              style={{ background: ACCENT_SWATCH[a] }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={cycleTheme}
          aria-label={t('header.theme')}
          className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ThemeIcon className="size-4" />
        </button>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as 'ja' | 'en')}
          aria-label="locale"
          className="rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none dark:border-gray-700"
        >
          <option value="ja">JA</option>
          <option value="en">EN</option>
        </select>
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label={t('header.settings')}
          className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <Settings className="size-4" />
        </button>
        <button
          type="button"
          aria-label={t('header.help')}
          className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <HelpCircle className="size-4" />
        </button>
      </div>
    </header>
  );
}
