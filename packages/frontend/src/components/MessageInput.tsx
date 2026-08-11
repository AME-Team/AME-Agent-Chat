/**
 * メッセージ入力 (要件 #2 §3.1)
 * マルチライン・自動リサイズ・Enter 送信 / Shift+Enter 改行・文字数カウント。
 * 下書き保持(セッション単位)・入力履歴(↑↓)・スラッシュコマンドサジェスト。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Paperclip, Send, Square } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useApp } from '../store/app';
import { useUI } from '../store/ui';
import { CommandPalette } from './CommandPalette';
import { executeCommand, matchCommands, parseCommand } from '../lib/commands';
import { api } from '../lib/api';

const DRAFT_PREFIX = 'draft:';
const HIST_PREFIX = 'history:';
const HIST_LIMIT = 20;

/** 入力履歴の現在位置 (単純循環) */
let upIdx = -1;

function loadDraft(sessionId: string): string {
  try {
    return localStorage.getItem(`${DRAFT_PREFIX}${sessionId}`) ?? '';
  } catch {
    return '';
  }
}
function saveDraft(sessionId: string, text: string): void {
  try {
    if (text) localStorage.setItem(`${DRAFT_PREFIX}${sessionId}`, text);
    else localStorage.removeItem(`${DRAFT_PREFIX}${sessionId}`);
  } catch {
    /* storage unavailable */
  }
}
function loadHistory(sessionId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`${HIST_PREFIX}${sessionId}`) ?? '[]') as string[];
  } catch {
    return [];
  }
}
function pushHistory(sessionId: string, text: string): void {
  try {
    const list = loadHistory(sessionId).filter((h) => h !== text);
    localStorage.setItem(
      `${HIST_PREFIX}${sessionId}`,
      JSON.stringify([text, ...list].slice(0, HIST_LIMIT)),
    );
  } catch {
    /* storage unavailable */
  }
}

export function MessageInput() {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const [files, setFiles] = useState<Array<{ name: string; dataUrl: string; mime: string }>>([]);
  const [fileSuggestions, setFileSuggestions] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const skipDraftRef = useRef(false);
  const busy = useApp((s) => s.busy);
  const sendMessage = useApp((s) => s.sendMessage);
  const abort = useApp((s) => s.abort);
  const currentId = useApp((s) => s.currentId);

  // セッション切替時に下書きを復元 + 履歴位置リセット (要件 #2 §3.1)
  useEffect(() => {
    setText(currentId ? loadDraft(currentId) : '');
    upIdx = -1;
  }, [currentId]);

  // 下書きをセッション単位で永続化 (履歴ナビ中の置換は保存しない)
  useEffect(() => {
    if (skipDraftRef.current) {
      skipDraftRef.current = false;
      return;
    }
    if (currentId) saveDraft(currentId, text);
  }, [text, currentId]);

  // 自動リサイズ (要件 #2 §3.1)
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [text]);

  const paletteQuery = text.trim().startsWith('/') && !text.trim().includes(' ') ? text.trim() : '';
  const matches = useMemo(() => matchCommands(paletteQuery), [paletteQuery]);
  const paletteVisible = paletteQuery !== '' && matches.length > 0;

  useEffect(() => setActive(0), [paletteQuery]);

  // @ファイル参照サジェスト (#2 §3.3): 末尾の @query を検出して候補表示
  const atMatch = useMemo(() => {
    const m = text.match(/(?:^|\s)@([\w./-]*)$/);
    return m ? { query: m[1] } : null;
  }, [text]);

  useEffect(() => {
    if (!atMatch || atMatch.query.length < 2) {
      setFileSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const hits = await api.files.search(atMatch.query);
        if (!cancelled) setFileSuggestions(hits.slice(0, 6));
      } catch {
        if (!cancelled) setFileSuggestions([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [atMatch]);

  const pickFile = (path: string) => {
    setText((prev) => prev.replace(/(?:^|\s)@[\w./-]*$/, ` @${path}`).replace(/^\s/, ''));
    setFileSuggestions([]);
  };

  // クリップボード貼付 (画像) — #2 §3.2
  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    for (const item of e.clipboardData.items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) void addFile(file);
        e.preventDefault();
        return;
      }
    }
  };

  const addFile = async (file: File) => {
    // 添付サイズ上限 (低コスト運用との整合) — #2 §3.2
    const MAX_BYTES = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_BYTES) {
      useUI
        .getState()
        .pushToast(
          `${t('chat.attachTooLarge')} (${Math.round(file.size / 1024 / 1024)}MB)`,
          'error',
        );
      return;
    }
    if (files.length >= 4) {
      useUI.getState().pushToast(t('chat.attachLimit'), 'error');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setFiles((prev) => [...prev, { name: file.name, mime: file.type, dataUrl }]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    for (const file of Array.from(e.dataTransfer.files)) void addFile(file);
  };

  const tokenEstimate =
    text.length > 0
      ? Math.ceil(text.length / (text.match(/[\u3040-\u30ff\u4e00-\u9fff]/) ? 1.5 : 4))
      : 0;

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setText('');
    const attachments = files.map((f) => ({ mime: f.mime, url: f.dataUrl, filename: f.name }));
    setFiles([]);
    if (currentId) pushHistory(currentId, value);
    const cmd = parseCommand(value);
    if (cmd) {
      await executeCommand(cmd.name, cmd.args);
    } else {
      await sendMessage(value, attachments);
    }
  };

  const pickCommand = (name: string) => setText(`${name} `);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // パレット表示中のキー操作は本コンポーネントで集約(二重実行回避)
    if (paletteVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, matches.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        pickCommand(matches[active].name);
        return;
      }
    }

    // 入力履歴の再利用 (要件 #2 §3.1) — マルチライン編集を壊さないよう
    // カーソルが先頭(↑)/末尾(↓)のときのみ履歴ナビへ (通常時はカーソル移動を優先)
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.shiftKey) {
      if (!currentId) return;
      const caret = taRef.current?.selectionStart ?? 0;
      const atBoundary = e.key === 'ArrowUp' ? caret === 0 : caret === text.length;
      if (!atBoundary) return;
      const hist = loadHistory(currentId);
      if (hist.length === 0) return;
      e.preventDefault();
      const idx = Math.max(
        0,
        Math.min(hist.length - 1, e.key === 'ArrowUp' ? upIdx + 1 : upIdx - 1),
      );
      upIdx = idx;
      skipDraftRef.current = true;
      setText(hist[idx] ?? '');
      return;
    }

    // Enter 送信 / Shift+Enter 改行 (要件 #2 §3.1)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="relative border-t border-gray-100 px-4 py-4 dark:border-gray-800">
      {paletteVisible && (
        <CommandPalette
          matches={matches}
          active={active}
          onActiveChange={setActive}
          onPick={pickCommand}
        />
      )}
      {fileSuggestions.length > 0 && (
        <div className="absolute bottom-full left-1/2 mb-2 w-72 -translate-x-1/2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800">
          {fileSuggestions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => pickFile(p)}
              className="block w-full truncate px-3 py-2 text-left text-xs font-mono hover:bg-primary/10"
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        className="relative mx-auto max-w-3xl"
      >
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={`${f.name}-${i}`}
                className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs dark:border-gray-700"
              >
                {f.name}
                <button
                  type="button"
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="remove"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-lg border border-gray-200 p-2 focus-within:border-primary dark:border-gray-700">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              for (const file of Array.from(e.target.files ?? [])) void addFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label={t('chat.attach')}
            className="flex size-8 items-center justify-center rounded-md text-gray-400 transition-colors duration-150 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <Paperclip className="size-4" />
          </button>
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={t('chat.placeholder')}
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-gray-400"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => void abort()}
              aria-label={t('chat.stop')}
              className="flex size-8 items-center justify-center rounded-md bg-gray-200 text-gray-700 transition-colors duration-150 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              <Square className="size-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!text.trim()}
              aria-label={t('chat.send')}
              className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors duration-150 hover:opacity-90 disabled:opacity-40"
            >
              <Send className="size-4" />
            </button>
          )}
        </div>
        <div className="mt-1 flex justify-end gap-2">
          <span className="text-xs text-gray-400">
            {text.length} chars · ~{tokenEstimate} tokens
          </span>
        </div>
      </div>
    </div>
  );
}
