/**
 * アプリ状態ストア (要件 #2 §2, §4, §5)
 * セッション一覧・現在のセッション・メッセージ・設定・SSE 適用を一元管理。
 */
import { create } from 'zustand';
import { api, type AppSession } from '../lib/api';
import type { AccentColor, Locale, SessionSortOrder, Theme } from '@ame-agent-chat/shared';

export interface AppMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  /** 推論プロセス(思考ブロック)。/thinking で表示切替 (#2 §5) */
  reasoning?: string;
  providerID?: string;
  modelID?: string;
  streaming?: boolean;
}

interface AppState {
  // settings
  theme: Theme;
  accent: AccentColor;
  locale: Locale;
  setTheme: (t: Theme) => void;
  setAccent: (a: AccentColor) => void;
  setLocale: (l: Locale) => void;

  // runtime
  reachable: boolean;
  busy: boolean;

  // sessions
  sessions: AppSession[];
  currentId: string | null;
  /** ピン留めしたセッション ID (localStorage 永続化) — #2 §2.3 */
  pinned: string[];
  /** 並び替え基準 (更新順/作成順/名前順) — #2 §2.3 */
  sortOrder: SessionSortOrder;
  loadSessions: () => Promise<void>;
  createSession: () => Promise<string>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  duplicateSession: (id: string) => Promise<string>;
  togglePin: (id: string) => void;
  setSortOrder: (order: SessionSortOrder) => void;

  // messages
  messages: AppMessage[];
  loadMessages: (id: string) => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  abort: () => Promise<void>;
  applySSE: (event: string, properties: unknown) => void;
  clearMessages: () => void;
}

interface OCPart {
  type: string;
  text?: string;
}
interface OCMessageEntry {
  info: {
    id: string;
    role: 'user' | 'assistant' | 'system';
    providerID?: string;
    modelID?: string;
  };
  parts: OCPart[];
}

function partsToText(parts: OCPart[] | undefined): string {
  return (parts ?? [])
    .filter((p) => p.type === 'text')
    .map((p) => p.text ?? '')
    .join('');
}

function partsToReasoning(parts: OCPart[] | undefined): string {
  return (parts ?? [])
    .filter((p) => p.type === 'reasoning')
    .map((p) => p.text ?? '')
    .join('');
}

/** OpenCode が通知した user メッセージ ID (楽観的表示と二重表示を防ぐ) */
const knownUserIds = new Set<string>();

export const useApp = create<AppState>((set, get) => ({
  theme: (localStorage.getItem('theme') as Theme) ?? 'system',
  accent: (localStorage.getItem('accent') as AccentColor) ?? 'trust-blue',
  locale: (localStorage.getItem('locale') as Locale) ?? 'ja',
  setTheme: (t) => {
    localStorage.setItem('theme', t);
    set({ theme: t });
  },
  setAccent: (a) => {
    localStorage.setItem('accent', a);
    set({ accent: a });
  },
  setLocale: (l) => {
    localStorage.setItem('locale', l);
    set({ locale: l });
  },

  reachable: false,
  busy: false,

  sessions: [],
  currentId: null,
  pinned: JSON.parse(localStorage.getItem('pinned') ?? '[]') as string[],
  sortOrder: (localStorage.getItem('sortOrder') as SessionSortOrder) ?? 'updated',

  loadSessions: async () => {
    try {
      const sessions = await api.sessions.list();
      set({ sessions, reachable: true });
    } catch {
      set({ reachable: false });
    }
  },

  createSession: async () => {
    const s = await api.sessions.create();
    set((st) => ({ sessions: [s, ...st.sessions], currentId: s.id, messages: [] }));
    return s.id;
  },

  selectSession: async (id) => {
    set({ currentId: id, messages: [] });
    await get().loadMessages(id);
  },

  deleteSession: async (id) => {
    await api.sessions.remove(id);
    set((st) => ({
      sessions: st.sessions.filter((s) => s.id !== id),
      pinned: st.pinned.filter((p) => p !== id),
      currentId: st.currentId === id ? null : st.currentId,
      messages: st.currentId === id ? [] : st.messages,
    }));
    localStorage.setItem('pinned', JSON.stringify(get().pinned));
  },

  renameSession: async (id, title) => {
    const s = await api.sessions.update(id, title);
    set((st) => ({ sessions: st.sessions.map((x) => (x.id === id ? s : x)) }));
  },

  duplicateSession: async (id) => {
    // メッセージ内容もコピーするため最終メッセージ地点でフォーク (#2 §2.1)
    const entries = (await api.messages.list(id)) as OCMessageEntry[];
    const lastID = entries.at(-1)?.info.id;
    const copy = await api.sessions.fork(id, lastID);
    await api.sessions.update(copy.id, `${copy.title} (copy)`);
    const renamed = await api.sessions.list();
    const session = renamed.find((s) => s.id === copy.id) ?? copy;
    set((st) => ({ sessions: [session, ...st.sessions], currentId: session.id, messages: [] }));
    await get().loadMessages(session.id);
    return session.id;
  },

  togglePin: (id) => {
    set((st) => {
      const pinned = st.pinned.includes(id)
        ? st.pinned.filter((p) => p !== id)
        : [...st.pinned, id];
      localStorage.setItem('pinned', JSON.stringify(pinned));
      return { pinned };
    });
  },

  setSortOrder: (order) => {
    localStorage.setItem('sortOrder', order);
    set({ sortOrder: order });
  },

  messages: [],

  loadMessages: async (id) => {
    try {
      const entries = (await api.messages.list(id)) as OCMessageEntry[];
      const messages: AppMessage[] = entries.map((e) => ({
        id: e.info.id,
        role: e.info.role,
        text: partsToText(e.parts),
        reasoning: partsToReasoning(e.parts) || undefined,
        providerID: e.info.providerID,
        modelID: e.info.modelID,
      }));
      set({ messages, reachable: true });
    } catch {
      set({ messages: [] });
    }
  },

  sendMessage: async (text) => {
    const { currentId, createSession, messages, sessions } = get();
    const id = currentId ?? (await createSession());
    // タイトル自動生成: 空/スラッグ相当タイトルの新規セッションは初回メッセージから命名 (#2 §2.2)
    const session = sessions.find((s) => s.id === id);
    if (session && /^[a-z0-9-]+$/.test(session.title)) {
      const title = text.replace(/\s+/g, ' ').trim().slice(0, 30) || 'New Chat';
      void api.sessions.update(id, title).then((s) => {
        set((st) => ({ sessions: st.sessions.map((x) => (x.id === id ? s : x)) }));
      });
    }
    // 楽観的なユーザーメッセージ (要件 #2 §4.3 Streaming 前の即時表示)
    const optimistic: AppMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      text,
    };
    set({ messages: [...messages, optimistic], busy: true });
    await api.messages.send(id, text);
  },

  abort: async () => {
    const id = get().currentId;
    if (id) await api.messages.abort(id);
    set({ busy: false });
  },

  applySSE: (event, properties) => {
    const p = properties as Record<string, unknown>;

    if (event === 'message.updated') {
      const info =
        (p.info as { id: string; role: string; providerID?: string; modelID?: string }) ?? {};
      if (info.role === 'assistant') {
        set((st) => {
          const exists = st.messages.some((m) => m.id === info.id);
          const messages = exists
            ? st.messages.map((m) =>
                m.id === info.id
                  ? { ...m, providerID: info.providerID, modelID: info.modelID, streaming: true }
                  : m,
              )
            : [
                ...st.messages,
                {
                  id: info.id,
                  role: 'assistant' as const,
                  text: '',
                  providerID: info.providerID,
                  modelID: info.modelID,
                  streaming: true,
                },
              ];
          return { messages };
        });
      } else if (info.role === 'user') {
        knownUserIds.add(info.id);
      }
    } else if (event === 'message.part.updated') {
      const part = p.part as { messageID: string; type: string; text?: string };
      if (!part || !part.messageID) return;
      if (part.type !== 'text' && part.type !== 'reasoning') return;
      if (knownUserIds.has(part.messageID)) return;
      const isReasoning = part.type === 'reasoning';
      const value = part.text ?? '';
      set((st) => {
        const exists = st.messages.some((m) => m.id === part.messageID);
        const messages = exists
          ? st.messages.map((m) =>
              m.id === part.messageID
                ? { ...m, [isReasoning ? 'reasoning' : 'text']: value, streaming: true }
                : m,
            )
          : [
              ...st.messages,
              {
                id: part.messageID,
                role: 'assistant' as const,
                text: isReasoning ? '' : value,
                reasoning: isReasoning ? value : undefined,
                streaming: true,
              },
            ];
        return { messages };
      });
    } else if (event === 'session.idle') {
      set((st) => ({
        busy: false,
        messages: st.messages.map((m) => ({ ...m, streaming: false })),
      }));
    } else if (event === 'session.status') {
      const status = (p.status as { type: string }) ?? { type: 'idle' };
      set({ busy: status.type === 'busy' });
    }
  },

  clearMessages: () => set({ messages: [] }),
}));
