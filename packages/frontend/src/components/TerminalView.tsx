/**
 * ターミナルパネル (Issue #65)
 * サンドボックス (Agent Core 経由の opencode session.shell) でコマンドを実行し、
 * 出力をモノスペース表示する。Ctrl+J で開閉 (App.tsx)。
 * 履歴・実行状態は useTerminal ストアに保持されるため、パネルを閉じても失われない。
 */
import { useEffect, useRef } from 'react';
import { ChevronDown, Play } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useUI } from '../store/ui';
import { useTerminal } from '../store/terminal';
import { useState } from 'react';

export function TerminalView() {
  const { t } = useI18n();
  const setTerminalOpen = useUI((s) => s.setTerminalOpen);
  const entries = useTerminal((s) => s.entries);
  const running = useTerminal((s) => s.running);
  const run = useTerminal((s) => s.run);
  const [command, setCommand] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 実行時に自動スクロール (下へ追従)
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, running]);

  const submit = () => {
    if (!command.trim() || running) return;
    const value = command;
    setCommand('');
    void run(value);
  };

  return (
    <div className="flex h-56 shrink-0 flex-col border-t border-gray-700 bg-gray-950 text-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-1.5">
        <span className="text-xs font-medium text-gray-400">{t('terminal.title')}</span>
        <button
          type="button"
          onClick={() => setTerminalOpen(false)}
          aria-label={t('terminal.close')}
          className="flex size-6 items-center justify-center rounded text-gray-400 transition-colors duration-150 hover:bg-gray-800 hover:text-gray-200"
        >
          <ChevronDown className="size-3.5" />
        </button>
      </div>
      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2 font-mono text-xs">
        {entries.length === 0 && <p className="text-gray-600">{t('terminal.placeholder')}</p>}
        {entries.map((e, i) => (
          <div key={i} className="mb-2">
            <div className="text-emerald-400">
              <span className="select-none text-gray-500">$ </span>
              {e.command}
            </div>
            <pre
              className={`whitespace-pre-wrap break-all ${
                e.error ? 'text-red-400' : 'text-gray-300'
              }`}
            >
              {e.output || '(no output)'}
            </pre>
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-1 text-gray-500">
            <span className="inline-block size-3 animate-pulse rounded-full bg-gray-500" />
            {t('terminal.running')}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-gray-800 px-3 py-1.5">
        <span className="select-none text-emerald-400">$</span>
        <input
          ref={inputRef}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={t('terminal.input')}
          autoFocus
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent font-mono text-xs text-gray-100 outline-none placeholder:text-gray-600"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!command.trim() || running}
          aria-label={t('terminal.run')}
          className="flex size-6 items-center justify-center rounded text-gray-400 transition-colors duration-150 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-40"
        >
          <Play className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
