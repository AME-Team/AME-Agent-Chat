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
  approvalHistoryOpen: boolean;
  authOpen: boolean;
  usageOpen: boolean;
  /** カレントディレクトリ選択ダイアログ (#56) */
  cwdOpen: boolean;
  /** サイドバー開閉 (#57) — localStorage 永続化 */
  sidebarCollapsed: boolean;
  preview: { type: 'markdown' | 'image'; content: string } | null;
  showThinking: boolean;
  showDetails: boolean;
  /** 複数リクエストの逐次処理のためキュー化 (上書き防止) */
  pendingPermissions: PendingPermission[];
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
  setHelpOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setApprovalHistoryOpen: (open: boolean) => void;
  setAuthOpen: (open: boolean) => void;
  setUsageOpen: (open: boolean) => void;
  setCwdOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setPreview: (p: UIState['preview']) => void;
  toggleThinking: () => void;
  toggleDetails: () => void;
  enqueuePermission: (p: PendingPermission) => void;
  removePermission: (id: string) => void;
}

export const useUI = create<UIState>((set, get) => ({
  toasts: [],
  helpOpen: false,
  settingsOpen: false,
  approvalHistoryOpen: false,
  authOpen: false,
  usageOpen: false,
  cwdOpen: false,
  sidebarCollapsed: localStorage.getItem('sidebarCollapsed') === 'true',
  preview: null,
  showThinking: true,
  showDetails: false,
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
  setApprovalHistoryOpen: (open) => set({ approvalHistoryOpen: open }),
  setAuthOpen: (open) => set({ authOpen: open }),
  setUsageOpen: (open) => set({ usageOpen: open }),
  setCwdOpen: (open) => set({ cwdOpen: open }),
  toggleSidebar: () => {
    // updater 内で副作用を起こさない (StrictMode 二重実行対策)
    const next = !get().sidebarCollapsed;
    localStorage.setItem('sidebarCollapsed', String(next));
    set({ sidebarCollapsed: next });
  },
  setPreview: (preview) => set({ preview }),
  toggleThinking: () => set((st) => ({ showThinking: !st.showThinking })),
  toggleDetails: () => set((st) => ({ showDetails: !st.showDetails })),
  enqueuePermission: (p) =>
    set((st) =>
      st.pendingPermissions.some((x) => x.id === p.id)
        ? st
        : { pendingPermissions: [...st.pendingPermissions, p] },
    ),
  removePermission: (id) =>
    set((st) => ({ pendingPermissions: st.pendingPermissions.filter((x) => x.id !== id) })),
}));
