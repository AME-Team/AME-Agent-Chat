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

/** /export: セッション内容を Markdown/JSON でダウンロード (要件 #2 §2.4) */
function exportSession(format: 'md' | 'json') {
  const { messages, sessions, currentId } = useApp.getState();
  const session = sessions.find((s) => s.id === currentId);
  const title = session?.title ?? 'session';
  const safeName = title.replace(/[\\/:*?"<>|]/g, '').trim() || 'session';

  if (format === 'json') {
    const data = JSON.stringify({ title, exportedAt: new Date().toISOString(), messages }, null, 2);
    download(`${safeName}.json`, data, 'application/json');
    return;
  }

  const md = [
    `# ${title}`,
    '',
    ...messages.map(
      (m) => `**${m.role}**${m.modelID ? ` (${m.providerID}/${m.modelID})` : ''}\n\n${m.text}\n`,
    ),
  ].join('\n');
  download(`${safeName}.md`, md, 'text/markdown');
}

function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Output Prompt 生成 (要件 #1 §3.5.1) — プロンプト + コンテキストを Markdown で出力 */
function generateOutputPrompt() {
  const { messages, sessions, currentId } = useApp.getState();
  const session = sessions.find((s) => s.id === currentId);
  const title = session?.title ?? 'session';
  const safeName = title.replace(/[\\/:*?"<>|]/g, '').trim() || 'session';
  const md = [
    '# Output Prompt',
    '',
    '## プロンプト',
    'このセッションの作業を引き継いでください。',
    '',
    '## コンテキスト',
    `- セッション: ${title}`,
    `- メッセージ数: ${messages.length}`,
    '',
    '### 作業履歴',
    ...messages.map((m, i) => `${i + 1}. **${m.role}**: ${m.text.split('\n')[0].slice(0, 80)}`),
  ].join('\n');
  download(`${safeName}-prompt.md`, md, 'text/markdown');
}

/** JSON インポート (要件 #2 §2.4) — ファイル選択から Gatekeeper へ復元 */
function importSession() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          title?: string;
          messages?: Array<{ role: string; text: string }>;
        };
        void api
          .importSession({
            title: parsed.title ?? 'imported',
            messages: Array.isArray(parsed.messages) ? parsed.messages : [],
          })
          .then((r) => {
            useUI
              .getState()
              .pushToast(
                `${tr('command.imported')} (${(r as { importedMessages?: number }).importedMessages ?? 0})`,
                'success',
              );
            void useApp.getState().loadSessions(); // 一覧をリフレッシュ
          });
      } catch {
        useUI.getState().pushToast(tr('command.importFailed'), 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
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
    case '/connect':
      ui.setAuthOpen(true);
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
      exportSession(args.trim().toLowerCase() === 'json' ? 'json' : 'md');
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
    case '/undo': {
      if (!app.currentId) {
        ui.pushToast(tr('command.selectSession'), 'error');
        return;
      }
      try {
        // 直前のユーザーメッセージへ revert (以降の生成を破棄・ファイル変更を含む元に戻す)
        const entries = (await api.messages.list(app.currentId)) as Array<{
          info: { id: string; role: string };
        }>;
        const lastUser = [...entries].reverse().find((e) => e.info.role === 'user');
        if (!lastUser) {
          ui.pushToast(tr('command.noRevertTarget'), 'info');
          return;
        }
        await api.messages.revert(app.currentId, lastUser.info.id);
        await app.loadMessages(app.currentId);
        ui.pushToast(tr('command.executed', { label }), 'success');
      } catch {
        ui.pushToast(tr('command.executeFailed', { label }), 'error');
      }
      return;
    }
    case '/redo': {
      if (!app.currentId) {
        ui.pushToast(tr('command.selectSession'), 'error');
        return;
      }
      try {
        await api.messages.unrevert(app.currentId);
        await app.loadMessages(app.currentId);
        ui.pushToast(tr('command.executed', { label }), 'success');
      } catch {
        ui.pushToast(tr('command.executeFailed', { label }), 'error');
      }
      return;
    }
    case '/details':
      ui.toggleDetails();
      ui.pushToast(
        useUI.getState().showDetails ? tr('command.detailsOn') : tr('command.detailsOff'),
        'info',
      );
      return;
    case '/share': {
      if (!app.currentId) {
        ui.pushToast(tr('command.selectSession'), 'error');
        return;
      }
      try {
        const res = await api.sessions.share(app.currentId);
        ui.pushToast(
          res.url ? `${tr('command.shared')} ${res.url}` : tr('command.shared'),
          'success',
        );
      } catch {
        ui.pushToast(tr('command.executeFailed', { label }), 'error');
      }
      return;
    }
    case '/unshare': {
      if (!app.currentId) {
        ui.pushToast(tr('command.selectSession'), 'error');
        return;
      }
      try {
        await api.sessions.unshare(app.currentId);
        ui.pushToast(tr('command.executed', { label }), 'success');
      } catch {
        ui.pushToast(tr('command.executeFailed', { label }), 'error');
      }
      return;
    }
    case '/prompt':
      generateOutputPrompt();
      ui.pushToast(tr('command.exported'), 'success');
      return;
    case '/import':
      importSession();
      return;
    default:
      ui.pushToast(tr('command.upcoming', { label }), 'info');
  }
}
