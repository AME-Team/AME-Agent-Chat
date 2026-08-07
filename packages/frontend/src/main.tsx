/**
 * Frontend (PWA) エントリポイント (要件 #1 §3.1.6)
 * テーマ・アクセント・locale を <html> へ反映し React をマウント。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { I18nContext, translate } from './lib/i18n';
import { useApp } from './store/app';
import './styles/index.css';

function applyThemeAttributes() {
  const { theme, accent, locale } = useApp.getState();
  const root = document.documentElement;

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  root.classList.toggle('dark', isDark);

  root.setAttribute('data-accent', accent);
  root.setAttribute('data-locale', locale);
  root.lang = locale;
}

function Root() {
  const locale = useApp((s) => s.locale);
  applyThemeAttributes();
  // 設定変更の都度 DOM 属性を更新
  useApp.subscribe(applyThemeAttributes);

  return (
    <I18nContext.Provider value={{ locale, t: (k) => translate(locale, k) }}>
      <StrictMode>
        <App />
      </StrictMode>
    </I18nContext.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
