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
}

interface UIState {
  toasts: Toast[];
  helpOpen: boolean;
  showThinking: boolean;
  pendingPermission: PendingPermission | null;
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  setHelpOpen: (open: boolean) => void;
  toggleThinking: () => void;
  setPendingPermission: (p: PendingPermission | null) => void;
}

export const useUI = create<UIState>((set) => ({
  toasts: [],
  helpOpen: false,
  showThinking: true,
  pendingPermission: null,
  pushToast: (message, tone = 'info') => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((st) => ({ toasts: [...st.toasts, { id, message, tone }] }));
    setTimeout(() => {
      set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) }));
    }, 3000);
  },
  dismissToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  setHelpOpen: (open) => set({ helpOpen: open }),
  toggleThinking: () => set((st) => ({ showThinking: !st.showThinking })),
  setPendingPermission: (p) => set({ pendingPermission: p }),
}));
