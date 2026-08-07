/**
 * UI 状態 (要件 #2 §9.2 通知・§5 /thinking・§6 /help)
 * トースト通知・ヘルプダイアログ開閉・思考ブロック表示を管理。
 */
import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

/** 保留中の承認リクエスト (要件 #2 §7) */
export interface PendingPermission {
  id: string;
  sessionId: string;
  type: string;
  path?: string;
  command?: string;
  description?: string;
  title?: string;
  policy?: string;
}

interface UIState {
  toasts: Toast[];
  helpOpen: boolean;
  settingsOpen: boolean;
  showThinking: boolean;
  /** 複数リクエストの逐次処理のためキュー化 (上書き防止) */
  pendingPermissions: PendingPermission[];
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  setHelpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  toggleThinking: () => void;
  enqueuePermission: (p: PendingPermission) => void;
  removePermission: (id: string) => void;
}

export const useUI = create<UIState>((set) => ({
  toasts: [],
  helpOpen: false,
  settingsOpen: false,
  showThinking: true,
  pendingPermissions: [],
  pushToast: (message, tone = 'info') => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((st) => ({ toasts: [...st.toasts, { id, message, tone }] }));
    setTimeout(() => {
      set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  toggleThinking: () => set((st) => ({ showThinking: !st.showThinking })),
  enqueuePermission: (p) =>
    set((st) =>
      st.pendingPermissions.some((x) => x.id === p.id)
        ? st
        : { pendingPermissions: [...st.pendingPermissions, p] },
    ),
  removePermission: (id) =>
    set((st) => ({ pendingPermissions: st.pendingPermissions.filter((x) => x.id !== id) })),
}));
