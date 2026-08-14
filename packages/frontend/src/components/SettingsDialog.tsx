/**
 * 設定ダイアログ (要件 #1 §3.2.1/§3.2.3, #2 §9.3)
 * Effort プリセット + 3層ティアの プロバイダー/モデル/推論量 + 圧縮設定。
 */
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import {
  CHAT_WIDTH_OPTIONS,
  EFFORT_PRESET_LABELS,
  REASONING_EFFORT_LABELS,
  type ChatWidth,
  type EffortPreset,
  type ModelTier,
  type ReasoningEffort,
} from '@ame-agent-chat/shared';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { useSettings } from '../store/settings';
import { useApp } from '../store/app';
import { api, ApiError } from '../lib/api';

const TIERS: ModelTier[] = ['high', 'middle', 'low'];
const REASONING: ReasoningEffort[] = ['high', 'middle', 'low', 'nothing'];
const PRESETS: EffortPreset[] = ['deep', 'smart', 'normal', 'lite', 'rush'];

export function ModelSettingsDialog() {
  const { t } = useI18n();
  const open = useUI((s) => s.settingsOpen);
  const setOpen = useUI((s) => s.setSettingsOpen);
  const chatWidth = useUI((s) => s.chatWidth);
  const setChatWidth = useUI((s) => s.setChatWidth);
  const enableOrchestration = useApp((s) => s.enableOrchestration);
  const setEnableOrchestration = useApp((s) => s.setEnableOrchestration);
  const setSelectedModel = useApp((s) => s.setSelectedModel);
  const {
    tiers,
    effortPreset,
    compressContext,
    loaded,
    loadError,
    load,
    setTier,
    setEffortPreset,
    setCompressContext,
    save,
  } = useSettings();
  const pushToast = useUI((s) => s.pushToast);
  const [downloadingLogs, setDownloadingLogs] = useState(false);

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

  const onDownloadLogs = async () => {
    if (downloadingLogs) return;
    setDownloadingLogs(true);
    try {
      const { blob, truncated } = await api.logs.download();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agent-core-${new Date().toISOString().slice(0, 10)}.log`;
      // DOM へ接続してから click する (未接続の a.click() は Firefox/Safari で無視されることがある)
      document.body.appendChild(a);
      a.click();
      // ダウンロード開始後の revoke は Firefox で中断されることがあるため遅延させる
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
      // 10MB 上限で末尾のみ返された場合、無自覚に欠落しないよう警告する
      pushToast(
        truncated ? t('settings.logsTruncated') : t('settings.logsDownloaded'),
        truncated ? 'info' : 'success',
      );
    } catch (err) {
      // 403 は「LOG_API_ENABLED=false」と「origin/トークン無効」で原因が異なるため、
      // レスポンス本文の機械可読な code で判別して正しい案内を出す (トークン失効等を誤誘導しない)
      const isDisabled =
        err instanceof ApiError &&
        err.status === 403 &&
        err.body &&
        typeof err.body === 'object' &&
        (err.body as { code?: string }).code === 'log_api_disabled';
      pushToast(
        isDisabled ? t('settings.logsDisabled') : t('settings.logsDownloadFailed'),
        'error',
      );
    } finally {
      setDownloadingLogs(false);
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
              {/* モバイルは縦展開、デスクトップは 1 行に収める (#43) */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
                <span className="text-sm font-medium sm:w-16">{tier}</span>
                <input
                  value={tiers[tier].provider}
                  onChange={(e) => setTier(tier, { provider: e.target.value })}
                  placeholder={t('settings.provider')}
                  aria-label={`${tier} ${t('settings.provider')}`}
                  className="min-w-0 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-primary dark:border-gray-600"
                />
                <input
                  value={tiers[tier].model}
                  onChange={(e) => setTier(tier, { model: e.target.value })}
                  placeholder={t('settings.model')}
                  aria-label={`${tier} ${t('settings.model')}`}
                  className="min-w-0 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm outline-none focus:border-primary dark:border-gray-600"
                />
                <select
                  value={tiers[tier].reasoningEffort}
                  onChange={(e) =>
                    setTier(tier, { reasoningEffort: e.target.value as ReasoningEffort })
                  }
                  aria-label={`${tier} ${t('settings.reasoning')}`}
                  className="min-w-0 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm outline-none dark:border-gray-600"
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
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={compressContext}
            onChange={(e) => setCompressContext(e.target.checked)}
            className="size-4"
          />
          {t('settings.compress')}
        </label>

        {/* LLM オーケストレーション (Issue #62) — デフォルト OFF。
            有効化時はヘッダーの明示モデル選択を Auto に戻し、自動ルーティングが
            明示選択でサイレントに無効化されないようにする。両者は app store 経由で
            即時・同時に永続化され、不整合な状態にならない */}
        <label className="mb-6 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enableOrchestration}
            onChange={(e) => {
              setEnableOrchestration(e.target.checked);
              if (e.target.checked) void setSelectedModel(null);
            }}
            className="size-4"
          />
          {t('settings.orchestration')}
        </label>

        {/* チャット幅 (Issue #63) — UI プリセットは localStorage に即時反映 */}
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('settings.chatWidth')}
          </h3>
          <div className="flex flex-wrap gap-1">
            {CHAT_WIDTH_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setChatWidth(w as ChatWidth)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
                  chatWidth === w
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                {t(`settings.chatWidth.${w}`)}
              </button>
            ))}
          </div>
        </section>

        {loadError && <p className="mb-4 text-sm text-red-600">{t('settings.saveFailed')}</p>}

        {/* ログ出力 (Issue #73) — 原因調査用 */}
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            {t('settings.logs')}
          </h3>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">{t('settings.logsDesc')}</p>
          <button
            type="button"
            onClick={() => void onDownloadLogs()}
            disabled={downloadingLogs}
            className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 transition-colors duration-150 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            <Download className="size-4" />
            {t('settings.logsDownload')}
          </button>
        </section>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={loadError}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 hover:opacity-90 disabled:opacity-40"
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
