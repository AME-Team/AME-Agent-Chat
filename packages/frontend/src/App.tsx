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
import { useApp } from './store/app';
import { useUI } from './store/ui';
import { connectEvents, disconnectEvents } from './lib/sse';
import { requestNotifyPermission } from './lib/notify';

export function App() {
  const loadSessions = useApp((s) => s.loadSessions);
  const createSession = useApp((s) => s.createSession);

  useEffect(() => {
    void loadSessions();
    connectEvents();
    requestNotifyPermission();
    return () => disconnectEvents();
  }, [loadSessions]);

  // キーボードショートカット (要件 #2 §9.1, §9.4)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        void createSession();
      }
      if (e.key === '?') {
        useUI.getState().setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createSession]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">
      <Sidebar />
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
    </div>
  );
}
