/**
 * 設定ダイアログ (要件 #1 §3.2.1/§3.2.3, #2 §9.3)
 * Effort プリセット + 3層ティアの プロバイダー/モデル/推論量 + 圧縮設定。
 */
import { useEffect } from 'react';
import { X } from 'lucide-react';
import {
  EFFORT_PRESET_LABELS,
  REASONING_EFFORT_LABELS,
  type EffortPreset,
  type ModelTier,
  type ReasoningEffort,
} from '@ame-agent-chat/shared';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { useSettings } from '../store/settings';

const TIERS: ModelTier[] = ['high', 'middle', 'low'];
const REASONING: ReasoningEffort[] = ['high', 'middle', 'low', 'nothing'];
const PRESETS: EffortPreset[] = ['deep', 'smart', 'normal', 'lite', 'rush'];

export function ModelSettingsDialog() {
  const { t } = useI18n();
  const open = useUI((s) => s.settingsOpen);
  const setOpen = useUI((s) => s.setSettingsOpen);
  const {
    tiers,
    effortPreset,
    compressContext,
    loaded,
    load,
    setTier,
    setEffortPreset,
    setCompressContext,
    save,
  } = useSettings();
  const pushToast = useUI((s) => s.pushToast);

  useEffect(() => {
    if (open && !loaded) void load();
  }, [open, loaded, load]);

  if (!open) return null;

  const onSave = async () => {
    try {
      await save();
      pushToast(t('settings.saved'), 'success');
    } catch {
      pushToast(t('settings.saveFailed'), 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setOpen(false)}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('settings.title')}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="close"
            className="flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Effort プリセット (#17) */}
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('settings.effort')}
          </h3>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setEffortPreset(p)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
                  effortPreset === p
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {EFFORT_PRESET_LABELS[p]}
              </button>
            ))}
          </div>
        </section>

        {/* 3層ティア設定 (#16) */}
        <section className="mb-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('settings.tiers')}
          </h3>
          {TIERS.map((tier) => (
            <div key={tier} className="rounded-md border border-gray-200 p-3 dark:border-gray-700">
              <div className="mb-2 flex items-center gap-2">
                <span className="w-16 text-sm font-medium">{tier}</span>
                <input
                  value={tiers[tier].provider}
                  onChange={(e) => setTier(tier, { provider: e.target.value })}
                  placeholder={t('settings.provider')}
                  aria-label={`${tier} ${t('settings.provider')}`}
                  className="flex-1 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-primary dark:border-gray-600"
                />
                <input
                  value={tiers[tier].model}
                  onChange={(e) => setTier(tier, { model: e.target.value })}
                  placeholder={t('settings.model')}
                  aria-label={`${tier} ${t('settings.model')}`}
                  className="flex-1 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-primary dark:border-gray-600"
                />
                <select
                  value={tiers[tier].reasoningEffort}
                  onChange={(e) =>
                    setTier(tier, { reasoningEffort: e.target.value as ReasoningEffort })
                  }
                  aria-label={`${tier} ${t('settings.reasoning')}`}
                  className="rounded border border-gray-200 bg-transparent px-2 py-1 text-sm outline-none dark:border-gray-600"
                >
                  {REASONING.map((r) => (
                    <option key={r} value={r}>
                      {REASONING_EFFORT_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </section>

        {/* プロンプト圧縮 (#18) */}
        <label className="mb-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={compressContext}
            onChange={(e) => setCompressContext(e.target.checked)}
            className="size-4"
          />
          {t('settings.compress')}
        </label>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void onSave()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90"
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
