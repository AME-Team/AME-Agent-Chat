/**
 * スラッシュコマンド実行 (要件 #2 §6)
 * クライアント処理(/new /theme /thinking /help /models 等)と
 * サーバ処理(/compact /init 等は Agent Core → OpenCode session.command)を振り分け。
 */
import { SLASH_COMMANDS, type SlashCommand } from '@ame-agent-chat/shared';
import { api } from './api';
import { useApp } from '../store/app';
import { useUI } from '../store/ui';
import type { Theme } from '@ame-agent-chat/shared';

export { SLASH_COMMANDS };
export type { SlashCommand };

/** 入力がコマンドか。`/` 始まりで第1トークを返す */
export function parseCommand(input: string): { name: string; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;
  const [name, ...rest] = trimmed.slice(1).split(/\s+/);
  return { name: `/${name}`, args: rest.join(' ') };
}

/** /export: セッション内容を Markdown でダウンロード (要件 #2 §2.4) */
function exportMarkdown() {
  const { messages, sessions, currentId } = useApp.getState();
  const session = sessions.find((s) => s.id === currentId);
  const md = [
    `# ${session?.title ?? 'Session'}`,
    '',
    ...messages.map(
      (m) => `**${m.role}**${m.modelID ? ` (${m.providerID}/${m.modelID})` : ''}\n\n${m.text}\n`,
    ),
  ].join('\n');
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${session?.title ?? 'session'}.md`;
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
      ui.pushToast('新規セッションを作成しました', 'success');
      return;
    case '/help':
      ui.setHelpOpen(true);
      return;
    case '/theme': {
      const order: Theme[] = ['light', 'dark', 'system'];
      const next = order[(order.indexOf(app.theme) + 1) % order.length];
      app.setTheme(next);
      ui.pushToast(`テーマ: ${next}`, 'info');
      return;
    }
    case '/thinking':
      ui.toggleThinking();
      ui.pushToast(`思考ブロック表示: ${useUI.getState().showThinking ? 'ON' : 'OFF'}`, 'info');
      return;
    case '/sessions':
      ui.pushToast('サイドバーからセッションを選択できます', 'info');
      return;
    case '/models':
      ui.pushToast('モデル/ティア設定は Effort プリセット (#16/#17) で対応予定', 'info');
      return;
    case '/export':
      exportMarkdown();
      ui.pushToast('Markdown エクスポートしました', 'success');
      return;
    case '/compact':
    case '/summarize':
    case '/init': {
      if (!app.currentId) {
        ui.pushToast('セッションを選択してください', 'error');
        return;
      }
      try {
        await api.messages.command(app.currentId, name.slice(1), args);
        ui.pushToast(`${label} を実行しました`, 'success');
      } catch {
        ui.pushToast(`${label} の実行に失敗しました`, 'error');
      }
      return;
    }
    default:
      ui.pushToast(`${label} は今後対応予定です`, 'info');
  }
}
