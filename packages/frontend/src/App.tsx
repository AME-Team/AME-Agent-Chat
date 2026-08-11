/**
 * アプリケーションルート (要件 #1 §3.1.1, §3.1.6)
 * レイアウト構成: サイドバー + ヘッダー + チャット + 入力欄。
 */
import { useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { MessageInput } from './components/MessageInput';
import { Toasts } from './components/Toasts';
import { HelpDialog } from './components/HelpDialog';
import { ApprovalDialog } from './components/ApprovalDialog';
import { ModelSettingsDialog } from './components/SettingsDialog';
import { ApprovalHistoryDialog } from './components/ApprovalHistoryDialog';
import { AuthDialog } from './components/AuthDialog';
import { UsageDialog } from './components/UsageDialog';
import { PreviewDialog } from './components/PreviewDialog';
import { DirectoryDialog } from './components/DirectoryDialog';
import { useApp } from './store/app';
import { useUI } from './store/ui';
import { connectEvents, disconnectEvents } from './lib/sse';
import { requestNotifyPermission } from './lib/notify';

export function App() {
  const loadSessions = useApp((s) => s.loadSessions);
  const createSession = useApp((s) => s.createSession);
  const loadCurrentDirectory = useApp((s) => s.loadCurrentDirectory);
  const cwdSwitchCount = useApp((s) => s.cwdSwitchCount);
  const sidebarCollapsed = useUI((s) => s.sidebarCollapsed);

  useEffect(() => {
    // 復元とセッション読込は並行実行する。server 側ミドルウェアが復元を試み、
    // 復元成功時はセッション一覧が復元後ディレクトリに紐づく (#56)。復元失敗時は
    // 既定ディレクトリのセッションで続行し、復元が遅れて成功した場合は store 側で
    // loadSessions() を再読込して補正する
    void loadCurrentDirectory();
    void loadSessions();
    connectEvents();
    requestNotifyPermission();
    return () => disconnectEvents();
  }, [loadSessions, loadCurrentDirectory]);

  // キーボードショートカット (要件 #2 §9.1, §9.4)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 入力欄ではショートカットを発火させない (IME 確定や ? 入力の誤発火防止)
      const target = e.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        if (!typing) {
          e.preventDefault();
          void createSession().catch(() => {});
        }
      } else if (e.key === '?' && !typing && !e.isComposing) {
        useUI.getState().setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createSession]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      {/* 起動時は key を変えず (復元で再マウントしない)、ユーザー切替時のみ
          カウンタ変化で Sidebar を再マウントして検索結果等をリセット */}
      <Sidebar key={cwdSwitchCount} collapsed={sidebarCollapsed} />
      <div className="flex flex-1 flex-col">
        <Header />
        <ChatView />
        <MessageInput />
      </div>
      <Toasts />
      <HelpDialog />
      <ApprovalDialog />
      <ModelSettingsDialog />
      <ApprovalHistoryDialog />
      <AuthDialog />
      <UsageDialog />
      <DirectoryDialog />
      <PreviewDialog />
    </div>
  );
}
