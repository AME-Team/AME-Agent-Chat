/**
 * スラッシュコマンド実行 (要件 #2 §6)
 * クライアント処理(/new /theme /thinking /help /models 等)と
 * サーバ処理(/compact /init 等は Agent Core → OpenCode session.command)を振り分け。
 */
import { SLASH_COMMANDS, type SlashCommand } from '@ame-agent-chat/shared';
import { api } from './api';
import { translate } from './i18n';
import { useApp } from '../store/app';
import { useUI } from '../store/ui';
import type { Theme } from '@ame-agent-chat/shared';

export { SLASH_COMMANDS };
export type { SlashCommand };

/** 現在 locale で翻訳(プレースホルダ補間は translate に統一) — ame-ui-philosophy §8 */
function tr(key: string, vars?: Record<string, string>): string {
  return translate(useApp.getState().locale, key, vars);
}

/** 入力がコマンドか。`/` 始まりで第1トークを返す(`/` 単独は null) */
export function parseCommand(input: string): { name: string; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const [name, ...rest] = trimmed.slice(1).split(/\s+/);
  if (!name) return null;
  return { name: `/${name}`, args: rest.join(' ') };
}

/** 入力からコマンド候補を算出 (未確定コマンド入力時のサジェスト用) */
export function matchCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  return SLASH_COMMANDS.filter(
    (c) => c.name.startsWith(q) || c.aliases?.some((a) => a.startsWith(q)),
  ).slice(0, 8);
}

/** /export: セッション内容を Markdown でダウンロード (要件 #2 §2.4) */
function exportMarkdown() {
  const { messages, sessions, currentId } = useApp.getState();
  const session = sessions.find((s) => s.id === currentId);
  const title = session?.title ?? 'session';
  const safeName = title.replace(/[\\/:*?"<>|]/g, '').trim() || 'session';
  const md = [
    `# ${title}`,
    '',
    ...messages.map(
      (m) => `**${m.role}**${m.modelID ? ` (${m.providerID}/${m.modelID})` : ''}\n\n${m.text}\n`,
    ),
  ].join('\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** コマンドを実行。UI 側で input をクリアする前提 */
export async function executeCommand(name: string, args: string): Promise<void> {
  const app = useApp.getState();
  const ui = useUI.getState();
  const cmd = SLASH_COMMANDS.find((c) => c.name === name || c.aliases?.includes(name));
  const label = cmd?.name ?? name;

  switch (name) {
    case '/new':
    case '/clear':
      await app.createSession();
      ui.pushToast(tr('command.newCreated'), 'success');
      return;
    case '/help':
      ui.setHelpOpen(true);
      return;
    case '/theme': {
      const order: Theme[] = ['light', 'dark', 'system'];
      const next = order[(order.indexOf(app.theme) + 1) % order.length];
      app.setTheme(next);
      ui.pushToast(tr('command.theme', { theme: next }), 'info');
      return;
    }
    case '/thinking':
      ui.toggleThinking();
      ui.pushToast(
        useUI.getState().showThinking ? tr('command.thinkingOn') : tr('command.thinkingOff'),
        'info',
      );
      return;
    case '/sessions':
      ui.pushToast(tr('command.sessions'), 'info');
      return;
    case '/models':
      ui.pushToast(tr('command.models'), 'info');
      return;
    case '/export':
      exportMarkdown();
      ui.pushToast(tr('command.exported'), 'success');
      return;
    case '/compact':
    case '/summarize':
    case '/init': {
      if (!app.currentId) {
        ui.pushToast(tr('command.selectSession'), 'error');
        return;
      }
      try {
        await api.messages.command(app.currentId, name.slice(1), args);
        ui.pushToast(tr('command.executed', { label }), 'success');
      } catch {
        ui.pushToast(tr('command.executeFailed', { label }), 'error');
      }
      return;
    }
    default:
      ui.pushToast(tr('command.upcoming', { label }), 'info');
  }
}
