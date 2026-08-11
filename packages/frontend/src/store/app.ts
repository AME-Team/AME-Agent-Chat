/**
 * アプリ状態ストア (要件 #2 §2, §4, §5)
 * セッション一覧・現在のセッション・メッセージ・設定・SSE 適用を一元管理。
 */
import { create } from 'zustand';
import { api, ApiError, type AppSession } from '../lib/api';
import { tr } from '../lib/i18n';
import { useUI } from './ui';
import type { AccentColor, Locale, SessionSortOrder, Theme } from '@ame-agent-chat/shared';

export interface AppMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  /** 推論プロセス(思考ブロック)。/thinking で表示切替 (#2 §5) */
  reasoning?: string;
  /** 親メッセージID (編集再生成 #21 で使用) */
  parentID?: string;
  providerID?: string;
  modelID?: string;
  streaming?: boolean;
}

/** プロセス可視化用のツール実行イベント (要件 #2 §8, #1 §3.1.4) */
export interface ToolEvent {
  id: string;
  name: string;
  state?: string;
  input?: string;
  time: number;
}

/** メッセージ添付ファイル (D&D / クリップボード貼付) — #2 §3.2 */
export interface Attachment {
  mime: string;
  url: string;
  filename?: string;
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

  // cwd (#56): カレントディレクトリ (agent-core 側で保持・永続化)
  currentDirectory: string;
  /** 起動時のカレントディレクトリ復元が未完了か */
  cwdLoading: boolean;
  /** ユーザーによるディレクトリ切替の回数 (Sidebar 再マウント用) */
  cwdSwitchCount: number;
  loadCurrentDirectory: () => Promise<void>;
  setCurrentDirectory: (directory: string) => Promise<void>;

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
  /** プロセス可視化 (#20) — セッション内のツール実行イベント */
  tools: ToolEvent[];
  loadMessages: (id: string) => Promise<void>;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  /** メッセージ編集 → 以降を上書きで再生成 (要件 #2 §4.4) */
  editMessage: (messageId: string, newText: string) => Promise<void>;
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
    parentID?: string;
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

/** 直前に自前で作成したセッション ID (タイトル自動生成の初回送信判定用) */
let lastCreatedId: string | null = null;

/** loadSessions の連番 (遅延到着した古い応答が新しい再読込結果を上書きしないための競合対策) */
let sessionsSeq = 0;

/** loadCurrentDirectory の進行中 Promise (StrictMode 二重マウント等の再入を防止) */
let loadCwdPromise: Promise<void> | null = null;

/** loadCurrentDirectory の世代番号 (背景ポーリングを新規呼び出しで無効化するためのガード) */
let cwdLoadGeneration = 0;

/** 指定 ms 後に abort する signal を返す。AbortSignal.timeout 非対応 (旧 Safari/WebView) は手動フォールバック */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

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
  currentDirectory: '',
  cwdLoading: true,
  cwdSwitchCount: 0,

  loadCurrentDirectory: () => {
    // 再入防止: 進行中の呼び出しがあれば同一 Promise を返す (StrictMode 二重マウント対策)
    if (loadCwdPromise) return loadCwdPromise;
    const gen = ++cwdLoadGeneration;
    loadCwdPromise = (async () => {
      // 再実行時も読み込み中表示を出す (初回以外の経路でも一方向にならないように)
      set({ cwdLoading: true });
      // 起動時の復元は opencode SDK 呼び出し (projects) も含むため予算を多めに取り、
      // 有効なディレクトリ (ready) が得られない場合は再試行する (#56)。
      // サーバ契約: ready=false かつ settingsOk=false は「設定未読 = 一時失敗 (再試行余地あり)」、
      // settingsOk=true は「恒久的な未設定」を表す
      let transient = false;
      let ready = false;
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const seq = get().cwdSwitchCount;
          try {
            const res = await api.cwd.get({ signal: timeoutSignal(8000) });
            // 試行中にユーザーがディレクトリ切替を完了していた場合は古い応答で上書きしない
            if (seq !== get().cwdSwitchCount) break;
            set({ currentDirectory: res.current });
            if (res.ready) {
              ready = true;
              break;
            }
            // 恒久的な未設定 (設定は読めた) なら再試行不要。一時失敗 (settingsOk=false) のみ再試行
            if (res.settingsOk) break;
            transient = true;
          } catch {
            transient = true;
          }
          // サーバ側の復元再試行抑制 (2 秒) を超える間隔でリトライし、
          // 各試行が実際にサーバ側の復元 fetch を起こせるようにする (#56)
          if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2500));
        }
      } finally {
        // 復元ループ完了 (例外/中断時も含む) で読み込み中表示を確実に解除
        set({ cwdLoading: false });
      }
      // 復元が初回に失敗しリトライで復元できた場合のみ、並行実行で既定ディレクトリのまま
      // 読み込み済みのセッション一覧を復元後ディレクトリ分へ再読込する (#56)。
      // 初回から ready だった場合は並行 loadSessions も復元後ディレクトリに紐づくため再読込しない
      if (ready && transient) {
        await get().loadSessions();
        return;
      }
      // 全試行が一時失敗した場合、Gatekeeper の復旧後にバックグラウンドで再確認し、
      // 復元できた時点でセッション一覧を補正する (#56)
      if (!ready && transient) {
        // 背景復元ポーリング中は「読み込み中」表示を継続する (未確定のまま未選択としない)
        set({ cwdLoading: true });
        const startCount = get().cwdSwitchCount;
        let checks = 0;
        const finish = (): void => {
          // 新規呼び出し (世代が進んだ) 場合はこのポーリングの状態変更を無効化する
          if (gen === cwdLoadGeneration) set({ cwdLoading: false });
        };
        const check = async (): Promise<void> => {
          if (gen !== cwdLoadGeneration) return;
          if (checks >= 3 || startCount !== get().cwdSwitchCount) {
            finish();
            return;
          }
          checks++;
          let res: { ready: boolean; current: string; settingsOk: boolean } | undefined;
          try {
            res = await api.cwd.get({ signal: timeoutSignal(8000) });
          } catch {
            /* 未復旧のため次回チェックへ */
            setTimeout(() => void check(), 5000);
            return;
          }
          // 恒久的な未設定 (設定は読めた) が判明したら再確認を打ち切る
          if (res.settingsOk) {
            finish();
            return;
          }
          if (!res.ready || !res.current) {
            setTimeout(() => void check(), 5000);
            return;
          }
          if (gen !== cwdLoadGeneration) return;
          set({ currentDirectory: res.current });
          finish();
          // セッション再読込の失敗は再確認のトリガーにしない (loadSessions 内部で catch 済み)
          await get().loadSessions();
        };
        setTimeout(() => void check(), 5000);
      }
    })().finally(() => {
      loadCwdPromise = null;
    });
    return loadCwdPromise;
  },

  setCurrentDirectory: async (directory) => {
    await api.cwd.set(directory);
    // ディレクトリ切替時はセッション一覧を新ディレクトリ分へ再読込する (#56)。
    // Sidebar はマウント時に fetch せず本 store を参照するため、リマウントと合わせても二重取得は発生しない
    set((st) => ({
      currentDirectory: directory,
      currentId: null,
      messages: [],
      tools: [],
      cwdSwitchCount: st.cwdSwitchCount + 1,
    }));
    await get().loadSessions();
  },

  sessions: [],
  currentId: null,
  pinned: JSON.parse(localStorage.getItem('pinned') ?? '[]') as string[],
  sortOrder: (localStorage.getItem('sortOrder') as SessionSortOrder) ?? 'updated',

  loadSessions: async () => {
    const seq = ++sessionsSeq;
    try {
      const sessions = await api.sessions.list();
      if (seq === sessionsSeq) set({ sessions, reachable: true });
    } catch {
      if (seq === sessionsSeq) set({ reachable: false });
    }
  },

  createSession: async () => {
    try {
      const s = await api.sessions.create();
      lastCreatedId = s.id;
      set((st) => ({ sessions: [s, ...st.sessions], currentId: s.id, messages: [], tools: [] }));
      return s.id;
    } catch (e) {
      // 未到達 (Agent Core への接続断: status 0 / OpenCode Server 未起動: 503) のみ
      // reachable=false として扱う (#44)。その他はサーバー実エラーのため reachable を維持する。
      if (e instanceof ApiError && (e.status === 0 || e.status === 503)) {
        set({ reachable: false });
        useUI.getState().pushToast(tr('chat.createSessionFailed'), 'error');
      } else {
        useUI.getState().pushToast(tr('chat.createSessionError'), 'error');
      }
      throw e;
    }
  },

  selectSession: async (id) => {
    set({ currentId: id, messages: [], tools: [] });
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
    // updater 内で副作用を起こさない (StrictMode 二重実行対策)
    const pinned = get().pinned.includes(id)
      ? get().pinned.filter((p) => p !== id)
      : [...get().pinned, id];
    localStorage.setItem('pinned', JSON.stringify(pinned));
    set({ pinned });
  },

  setSortOrder: (order) => {
    localStorage.setItem('sortOrder', order);
    set({ sortOrder: order });
  },

  messages: [],

  tools: [],

  loadMessages: async (id) => {
    try {
      const entries = (await api.messages.list(id)) as OCMessageEntry[];
      const messages: AppMessage[] = entries.map((e) => ({
        id: e.info.id,
        role: e.info.role,
        text: partsToText(e.parts),
        reasoning: partsToReasoning(e.parts) || undefined,
        parentID: e.info.parentID,
        providerID: e.info.providerID,
        modelID: e.info.modelID,
      }));
      set({ messages, reachable: true });
    } catch {
      set({ messages: [] });
    }
  },

  sendMessage: async (text, attachments = []) => {
    const { currentId, createSession, messages } = get();
    let id = currentId;
    if (!id) {
      try {
        id = await createSession();
      } catch {
        // 作成失敗時は createSession がエラートーストを表示済み → 送信を中断
        return;
      }
    }

    // !Bash (#2 §3.3): サンドボックス実行 → 出力をアシスタントメッセージとして追加
    //   ※ Markdown 画像記法 `![...]` との衝突を回避
    if (text.trim().startsWith('!') && !text.trim().startsWith('![')) {
      const optimistic: AppMessage = { id: `local-${Date.now()}`, role: 'user', text };
      set({ messages: [...messages, optimistic], busy: true });
      try {
        const res = await api.messages.bash(id, text.trim().slice(1).trim());
        const output =
          typeof res.bash.output === 'string'
            ? res.bash.output
            : JSON.stringify(res.bash.output, null, 2);
        const assistant: AppMessage = {
          id: `bash-${Date.now()}`,
          role: 'assistant',
          text: `\`\`\`bash\n$ ${res.bash.command}\n\`\`\`\n\n${output}`,
        };
        set((st) => ({ messages: [...st.messages, assistant], busy: false }));
      } catch (e) {
        set((st) => ({
          busy: false,
          messages: [
            ...st.messages,
            {
              id: `bash-${Date.now()}`,
              role: 'assistant',
              text: `${tr('bash.failed')}: ${String(e)}`,
            },
          ],
        }));
      }
      return;
    }

    // タイトル自動生成: 自前で作成した直後のセッションの初回送信時のみ命名 (#2 §2.2)
    if (lastCreatedId === id) {
      lastCreatedId = null;
      const title = text.replace(/\s+/g, ' ').trim().slice(0, 30) || 'New Chat';
      void api.sessions.update(id, title).then((s) => {
        set((st) => ({ sessions: st.sessions.map((x) => (x.id === id ? s : x)) }));
      });
    }
    // 楽観的なユーザーメッセージ (要件 #2 §4.3 Streaming 前の即時表示)
    const optimistic: AppMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      text: attachments.length
        ? `${text}\n\n[添付: ${attachments.map((a) => a.filename ?? a.mime).join(', ')}]`
        : text,
    };
    set({ messages: [...messages, optimistic], busy: true });
    await api.messages.send(id, text, undefined, attachments);
  },

  abort: async () => {
    const id = get().currentId;
    if (id) await api.messages.abort(id);
    set({ busy: false });
  },

  editMessage: async (messageId, newText) => {
    const { currentId, messages } = get();
    if (!currentId) return;
    const target = messages.find((m) => m.id === messageId);
    if (!target || target.role !== 'user') return;
    const parentId = target.parentID;
    if (parentId) {
      // 編集メッセージの親まで revert → 編集内容を再送 (以降を上書き再生成 #2 §4.4)
      try {
        await api.messages.revert(currentId, parentId);
      } catch {
        /* revert 失敗時は再送のみ */
      }
    }
    // 編集メッセージ以降を切り捨てて新しい内容を送信
    const idx = messages.findIndex((m) => m.id === messageId);
    set((st) => ({ messages: [...st.messages.slice(0, idx), { ...target, text: newText }] }));
    await api.messages.send(currentId, newText);
    // バックエンドと状態を再同期 (revert 不可のケースでも旧メッセージが復活しないように)
    await get().loadMessages(currentId);
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
      const part = p.part as {
        messageID: string;
        type: string;
        text?: string;
        tool?: string;
        state?: string;
        input?: unknown;
      };
      if (!part || !part.messageID) return;
      // プロセス可視化: ツール実行イベントを追跡 (#20, #2 §8) — 同一ツールは upsert
      if (part.type === 'tool' && part.tool) {
        const toolName: string = part.tool;
        const toolInput =
          typeof part.input === 'string' ? part.input : JSON.stringify(part.input ?? '');
        set((st) => {
          const exists = st.tools.some((t) => t.id === part.messageID + toolName);
          const tools = exists
            ? st.tools.map((t) =>
                t.id === part.messageID + toolName
                  ? { ...t, state: part.state, input: toolInput, time: Date.now() }
                  : t,
              )
            : [
                ...st.tools,
                {
                  id: part.messageID + toolName,
                  name: toolName,
                  state: part.state,
                  input: toolInput,
                  time: Date.now(),
                },
              ];
          return { tools };
        });
        return;
      }
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
