/**
 * ヘッダー (要件 #2 §9.1, §9.3)
 * テーマ切替・1ポイントカラー切替・言語切替の基本操作。
 * サイドバー開閉 (#57)・カレントディレクトリ選択 (#56)。
 */
import {
  Folder,
  HelpCircle,
  Monitor,
  Moon,
  PanelLeft,
  Settings,
  ShieldCheck,
  Sun,
} from 'lucide-react';
import { BarChart3 } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useI18n } from '../lib/i18n';
import { cn } from '../lib/cn';
import { useApp } from '../store/app';
import { useModels } from '../store/models';
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
  const setApprovalHistoryOpen = useUI((s) => s.setApprovalHistoryOpen);
  const setUsageOpen = useUI((s) => s.setUsageOpen);
  const setCwdOpen = useUI((s) => s.setCwdOpen);
  const sidebarCollapsed = useUI((s) => s.sidebarCollapsed);
  const toggleSidebar = useUI((s) => s.toggleSidebar);
  const currentDirectory = useApp((s) => s.currentDirectory);
  const cwdLoading = useApp((s) => s.cwdLoading);
  const selectedModel = useApp((s) => s.selectedModel);
  const setSelectedModel = useApp((s) => s.setSelectedModel);
  const enableOrchestration = useApp((s) => s.enableOrchestration);
  const models = useModels((s) => s.options);
  const modelsLoaded = useModels((s) => s.loaded);
  const loadModels = useModels((s) => s.load);

  // モデル一覧を一度だけ取得 (Issue #62)
  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  // プロバイダー毎にグループ化した選択肢 (値は `providerID|modelID`)
  const providers = useMemo(() => {
    const groups = new Map<string, Array<{ modelID: string; label: string }>>();
    for (const m of models) {
      const list = groups.get(m.providerID) ?? [];
      list.push({ modelID: m.modelID, label: m.label });
      groups.set(m.providerID, list);
    }
    return [...groups.entries()];
  }, [models]);
  const modelValue = selectedModel ? `${selectedModel.providerID}|${selectedModel.modelID}` : '';
  // 復元済みの選択モデルが一覧に無い (取得前 or モデル廃止) 場合も、
  // UI 上「Auto」表示のまま挙動が乖離しないよう選択肢に補完する
  const optionValues = new Set(
    providers.flatMap(([provider, list]) => list.map((m) => `${provider}|${m.modelID}`)),
  );
  const modelOptionMissing = modelValue !== '' && !optionValues.has(modelValue);

  const onModelChange = (value: string) => {
    if (!value) {
      void setSelectedModel(null);
      return;
    }
    const [providerID, modelID] = value.split('|');
    if (providerID && modelID) {
      // 明示モデル選択時はオーケストレーションを OFF に戻し、自動ルーティングと排他にする。
      // setSelectedModel が enableOrchestration も 1 PUT で原子更新するため、ここでは選択のみを行う
      void setSelectedModel({ providerID, modelID });
    }
  };

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between px-4">
      <div className="flex min-w-0 items-center gap-2">
        {/* サイドバー開閉 (#57) */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={t(sidebarCollapsed ? 'header.sidebarExpand' : 'header.sidebarCollapse')}
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <PanelLeft className="size-4" />
        </button>
        <h1 className="truncate text-base font-bold">{t('app.title')}</h1>
      </div>
      <div className="flex items-center gap-2">
        {/* カレントディレクトリ表示・選択 (#56) */}
        <button
          type="button"
          onClick={() => setCwdOpen(true)}
          aria-label={t('cwd.open')}
          className="flex h-8 max-w-48 items-center gap-1.5 rounded-md px-2 text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        >
          <Folder className="size-4 shrink-0" />
          <span className="truncate font-mono text-xs">
            {currentDirectory ? currentDirectory : cwdLoading ? t('cwd.loading') : t('cwd.empty')}
          </span>
        </button>
        {/* モデル選択 (Issue #62): 明示選択時はそのモデルで動作、未選択は既定/オーケストレーション。
            オーケストレーション ON 中は無効化 (明示モデル優先によるサイレント無効化を防ぐ) */}
        <select
          value={modelValue}
          onChange={(e) => onModelChange(e.target.value)}
          onFocus={() => {
            // 未取得 (loaded=false) のままだった場合、ドロップダウン再オープンで再取得する
            if (!modelsLoaded) void loadModels();
          }}
          disabled={enableOrchestration}
          aria-label={t('header.model')}
          title={enableOrchestration ? t('header.modelDisabled') : t('header.model')}
          className="max-w-44 rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs outline-none disabled:opacity-50 dark:border-gray-700"
        >
          <option value="">{t('header.modelDefault')}</option>
          {modelOptionMissing && (
            <option value={modelValue}>
              {selectedModel ? `${selectedModel.providerID}/${selectedModel.modelID}` : ''}
            </option>
          )}
          {providers.map(([provider, list]) => (
            <optgroup key={provider} label={provider}>
              {list.map((m) => (
                <option key={m.modelID} value={`${provider}|${m.modelID}`}>
                  {m.modelID}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
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
          onClick={() => setUsageOpen(true)}
          aria-label={t('usage.title')}
          className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <BarChart3 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setApprovalHistoryOpen(true)}
          aria-label={t('approval.historyOpen')}
          className="flex size-8 items-center justify-center rounded-md text-gray-500 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ShieldCheck className="size-4" />
        </button>
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
