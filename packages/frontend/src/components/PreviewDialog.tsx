/**
 * 成果物プレビュー (要件 #1 §3.1.2 基盤 / #23)
 * Markdown / 画像 のリードオンリープレビューを提供。
 * Office/PDF/Drawio/動画/Mermaid/React Flow 等は後続アダプタで拡張する。
 */
import { X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { Markdown } from './Markdown';

export function PreviewDialog() {
  const { t } = useI18n();
  const preview = useUI((s) => s.preview);
  const setPreview = useUI((s) => s.setPreview);

  if (!preview) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={() => setPreview(null)}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white p-6 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t('preview.title')}</h2>
          <button
            type="button"
            onClick={() => setPreview(null)}
            aria-label="close"
            className="flex size-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {preview.type === 'image' ? (
            <img src={preview.content} alt="preview" className="max-w-full rounded-md" />
          ) : (
            <Markdown>{preview.content}</Markdown>
          )}
        </div>
      </div>
    </div>
  );
}
