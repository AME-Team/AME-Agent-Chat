/**
 * アプリ状態ストア (要件 #2 §2, §4, §5)
 * セッション一覧・現在のセッション・メッセージ・設定・SSE 適用を一元管理。
 */
import { create } from 'zustand';
import { api, ApiError, type AppSession } from '../lib/api';
import { tr } from '../lib/i18n';
import { useUI } from './ui';
import {
  DEFAULT_AGENT_MODE,
  normalizeAgentMode,
  type AccentColor,
  type AgentMode,
  type Locale,
  type SessionSortOrder,
  type Theme,
} from '@ame-agent-chat/shared';

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
  /**
   * ユーザー切替の世代 (Sidebar 再マウント用 + #71 の孤児判定用)。
   * 契約: この値はユーザー操作由来の setCurrentDirectory のみが増加させる。
   * 起動時復元 (loadCurrentDirectory)・リロードは増加させない。孤児判定はこの前提に依存する。
   * またストアはモジュールシングルトンで、再初期化はページ再読込時のみ発生し
   * in-flight の createSession を跨がないため、カウンタが途中で巻き戻ることはない。
   */
  cwdSwitchCount: number;
  loadCurrentDirectory: () => Promise<void>;
  setCurrentDirectory: (directory: string) => Promise<void>;

  // sessions
  sessions: AppSession[];
  currentId: string | null;
  /**
   * メッセージ送信済み (または履歴を持つ) セッション ID の集合 (#71)。
   * 「新規チャット」連打による空セクション増殖の防護で、現在セクションが
   * 未送信かどうかを messages 配列長のみに依存せず判定するための堅牢化フラグ。
   * clearMessages 等で messages が空でも送信済みセッションを未送信と誤判定しない。
   */
  touchedSessionIds: Set<string>;
  /** 現在履歴読込中のセッション ID (未読込中の誤流用を防ぐ #71) */
  messagesLoadingId: string | null;
  /** createSession の in-flight Promise (連打時に同一結果を返し二重作成を防ぐ #71)。
   *  store state に保持するのはテストで setState リセット可能にするため */
  inFlightCreatePromise: Promise<string | null> | null;
  /** createSession が currentId を切り替えた世代 (下書き復元の競合対策用・決定的な判定に使う) */
  sessionCreateSeq: number;
  /** ピン留めしたセッション ID (localStorage 永続化) — #2 §2.3 */
  pinned: string[];
  /** 並び替え基準 (更新順/作成順/名前順) — #2 §2.3 */
  sortOrder: SessionSortOrder;
  loadSessions: () => Promise<void>;
  /** 新規セッション作成 (未送信の空セクションなら現在セクションを返す #71)。
   *  履歴読込待ち等で作成できない場合は null (呼び出し側で未選択扱いにすること) */
  createSession: () => Promise<string | null>;
  selectSession: (id: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  duplicateSession: (id: string) => Promise<string>;
  togglePin: (id: string) => void;
  setSortOrder: (order: SessionSortOrder) => void;

  // model selection / orchestration (Issue #62)
  /** ユーザーが明示選択したモデル (null = opencode 既定 / オーケストレーション) */
  selectedModel: { providerID: string; modelID: string } | null;
  /** LLM オーケストレーション有効フラグ (デフォルト OFF) */
  enableOrchestration: boolean;
  loadRuntimeSettings: () => Promise<void>;
  setSelectedModel: (
    m: { providerID: string; modelID: string } | null,
    opts?: { persist?: boolean },
  ) => Promise<void>;
  setEnableOrchestration: (v: boolean) => Promise<void>;

  // messages
  messages: AppMessage[];
  /** プロセス可視化 (#20) — セッション内のツール実行イベント */
  tools: ToolEvent[];
  /** 現在セッションのエージェントモード (Issue #72) — セッション単位で永続化 */
  agentMode: AgentMode;
  /** エージェントモードを設定 (現在セッションへ localStorage 永続化) */
  setAgentMode: (mode: AgentMode) => void;
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

/** OpenCode のメッセージ一覧エントリをアプリ表示用 AppMessage へ変換する */
function entriesToMessages(entries: OCMessageEntry[]): AppMessage[] {
  return entries.map((e) => ({
    id: e.info.id,
    role: e.info.role,
    text: partsToText(e.parts),
    reasoning: partsToReasoning(e.parts) || undefined,
    parentID: e.info.parentID,
    providerID: e.info.providerID,
    modelID: e.info.modelID,
  }));
}

/** OpenCode が通知した user メッセージ ID (楽観的表示と二重表示を防ぐ) */
const knownUserIds = new Set<string>();

/** エージェントモードの localStorage プレフィックス (セッション単位の永続化 — Issue #72) */
const AGENT_MODE_PREFIX = 'agentMode:';

function loadAgentMode(sessionId: string): AgentMode {
  try {
    return normalizeAgentMode(localStorage.getItem(`${AGENT_MODE_PREFIX}${sessionId}`));
  } catch {
    return DEFAULT_AGENT_MODE;
  }
}

function saveAgentMode(sessionId: string, mode: AgentMode): void {
  try {
    localStorage.setItem(`${AGENT_MODE_PREFIX}${sessionId}`, mode);
  } catch {
    /* storage unavailable */
  }
}

// touchedSessionIds (送信済みセッション判定 #71) の更新ヘルパー。
// 追加/削除はこの 2 関数 (と setCurrentDirectory 内の全消去) に集約する。
// 削除 (空確定) は loadMessages のみが担い、resyncMessages / sendMessage は追加のみ行う。
function markTouched(id: string): void {
  // ディレクトリ切替後に旧ディレクトリのセッション履歴が遅延完了しても、新 (空) の
  // touchedSessionIds へ再登録しない (setCurrentDirectory のリセットと一貫化 #71)
  if (useApp.getState().currentId !== id) return;
  useApp.setState((st) => ({ touchedSessionIds: new Set(st.touchedSessionIds).add(id) }));
}
function unmarkTouched(id: string): void {
  useApp.setState((st) => {
    const next = new Set(st.touchedSessionIds);
    next.delete(id);
    return { touchedSessionIds: next };
  });
}

/**
 * セッションごとの送信成功世代 (#71)。send 前に採られた古い履歴読込が空応答で
 * 遅延完了しても、同セッションへの送信成功 (markTouched) を stale な unmark が
 * 巻き戻さないための判定に使う。セッション単位で管理し、別セッションの送信と
 * 干渉しない (グローバル世代だと空判定の抑制が過剰に働くため)。
 */
const sendGenBySession = new Map<string, number>();

function markSend(id: string): void {
  sendGenBySession.set(id, (sendGenBySession.get(id) ?? 0) + 1);
}

/** テスト専用: モジュールレベルの状態を初期化する (#71)。テストが直接依存する
 *  (送信世代・読込世代・タイトル生成) に加え、同種の参照状態も揃えてリセットする */
export function resetAppModuleTestState(): void {
  sendGenBySession.clear();
  messagesLoadSeq = 0;
  lastCreatedId = null;
  sessionsSeq = 0;
  knownUserIds.clear();
  loadCwdPromise = null;
}

/** 直前に自前で作成したセッション ID (タイトル自動生成の初回送信判定用) */
let lastCreatedId: string | null = null;

/** loadSessions の連番 (遅延到着した古い応答が新しい再読込結果を上書きしないための競合対策) */
let sessionsSeq = 0;

/**
 * loadMessages の読込世代 (#71)。並行して走った古い読込が新しい読込の
 * messagesLoadingId を消したり、store 反映を上書きしたりしないための判定に使う。
 */
let messagesLoadSeq = 0;

/** loadCurrentDirectory の進行中 Promise (StrictMode 二重マウント等の再入を防止) */
let loadCwdPromise: Promise<void> | null = null;

/** loadCurrentDirectory の世代番号 (背景ポーリングを新規呼び出しで無効化するためのガード) */
let cwdLoadGeneration = 0;

/** loadRuntimeSettings の再試行タイマー (BFF 未起動時の復旧用 — Issue #62) */
let settingsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let settingsRetries = 0;
const SETTINGS_MAX_RETRIES = 5;
const SETTINGS_RETRY_DELAY_MS = 4000;

/** オーケストレーション有効化時に退避する選択中モデルの localStorage キー (無効化時に復元) */
const ORCH_MODEL_STASH_KEY = 'orchestrationModelStash';

/** 指定 ms 後に abort する signal を返す。AbortSignal.timeout 非対応 (旧 Safari/WebView) は手動フォールバック */
function timeoutSignal(ms: number): AbortSignal {
  if (typeof AbortSignal.timeout === 'function') return AbortSignal.timeout(ms);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

/** サーバ状態への再同期のタイムアウト (SSE 欠落時・送信失敗時のフォールバック共通) */
const RESYNC_TIMEOUT_MS = 10_000;

/**
 * サーバの実メッセージで再同期する (タイムアウト付きベストエフォート)。
 * loadMessages と異なり、送信途中の楽観的メッセージ (local-*) は保持する。
 * これによりタイムアウト後の遅延完了でも、その間に追加された新しい楽観的メッセージを
 * 消さない (再同期と並行送信の競合対策)。
 */
async function resyncMessages(id: string): Promise<void> {
  await Promise.race([
    (async () => {
      try {
        const entries = (await api.messages.list(id)) as OCMessageEntry[];
        // 送信永続化が確認できる場合のみ送信済みとして扱う (add のみ #71)
        if (entries.length > 0) markTouched(id);
        const serverMessages = entriesToMessages(entries);
        useApp.setState((st) => {
          // タイムアウト後に完了した場合でも、セッション切替後は適用しない (stale ガード)
          if (st.currentId !== id) return {};
          return {
            messages: [...serverMessages, ...st.messages.filter((m) => m.id.startsWith('local-'))],
            reachable: true,
          };
        });
      } catch {
        /* 再同期はベストエフォート */
      }
    })(),
    new Promise((resolve) => setTimeout(resolve, RESYNC_TIMEOUT_MS)),
  ]);
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
    // 旧ディレクトリのセッションに紐づく state (送信済み集合・履歴読込中・送信世代) を
    // リセットし、in-flight の createSession も null 化する (古い run は自分の finally が
    // 最新か確認するため新しい in-flight を誤消去しない #71)。
    // cwdSwitchCount を増加 = ユーザー切替の開始。同一ディレクトリ再選択も計上する
    // (一覧再読込と Sidebar 再マウントを実行するため、意図的)。cwd.set が例外を投げた場合
    // は以降の set が実行されずカウンタも currentDirectory も変わらないため、孤児判定は
    // 発火しない (安全側・誤削除なし)
    sendGenBySession.clear();
    set((st) => ({
      currentDirectory: directory,
      currentId: null,
      messages: [],
      tools: [],
      agentMode: DEFAULT_AGENT_MODE,
      touchedSessionIds: new Set(),
      messagesLoadingId: null,
      inFlightCreatePromise: null,
      cwdSwitchCount: st.cwdSwitchCount + 1,
    }));
    await get().loadSessions();
  },

  sessions: [],
  currentId: null,
  touchedSessionIds: new Set<string>(),
  messagesLoadingId: null,
  inFlightCreatePromise: null,
  sessionCreateSeq: 0,
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
    // Issue #71: 未送信の新規セクション (メッセージ 0 件) が選択中のまま「新規チャット」を
    // 連打するとセクションが増殖するため、作成せず現在のセクションを返す。
    // 未送信判定は messages 配列長に加え、送信済みセッション ID 集合 (touchedSessionIds)
    // で行う (clearMessages 等で messages が空でも送信済みセッションを未送信と誤判定しない)。
    // 連打・ダブルクリックの並行実行は同一 Promise を返して二重作成を防ぐ。
    const pending = get().inFlightCreatePromise;
    if (pending) return pending;
    const run = (async () => {
      // 呼び出し時のディレクトリ状態を捕捉。孤児判定は「ユーザー切替が発生し、
      // かつ現在値が元のディレクトリと異なる」場合のみ行う (#71)。
      // - cwdSwitchCount: 起動時復元/リロードは増えないため切替と区別できる
      // - currentDirectory: 切替→元に戻った場合は値が変わらないため、正常な作成を残せる
      const cwdSwitchAtStart = get().cwdSwitchCount;
      const dirAtStart = get().currentDirectory;
      const { currentId, messages } = get();
      // 不変条件: currentId は selectSession / duplicateSession (loadMessages 経由で履歴確定)
      // または createSession (履歴の無い新規) のみで設定される。loadSessions 等が直接
      // currentId を set することはないため、「未読込だが履歴を持つ」状態は存在しない。
      // 流用判定 (§71) はこの前提の上で messages 空 + 未送信 = 未読込でも安全な新規のみを対象とする
      const current = currentId ? get().sessions.find((s) => s.id === currentId) : undefined;
      if (
        current &&
        currentId !== null &&
        // 無題 (既定の空タイトル) の空セッションのみ流用する。ユーザーがリネームした
        // 空セッションへの「新規チャット」は意図的な操作のため新規作成する (#71)
        !current.title &&
        messages.length === 0 &&
        !get().touchedSessionIds.has(currentId) &&
        // 履歴読込が進行中のセッションは未判定のため流用しない (読込完了後に再判定 #71)
        get().messagesLoadingId !== currentId
      ) {
        // 未タイトルの空セッションを流用するので、初回送信時にタイトル自動生成を発火させる
        lastCreatedId = currentId;
        return currentId;
      }
      try {
        const s = await api.sessions.create();
        lastCreatedId = s.id;
        // 新規セッションは現在のエージェントモードを引き継ぐ (Issue #72):
        //   - セッション選択中 → 現行セッションのモード (OpenCode のスティッキーなモード切替相当)
        //   - セッション未選択 → setAgentMode がメモリ上に保持する保留モード
        const pendingMode = get().agentMode;
        if (get().cwdSwitchCount !== cwdSwitchAtStart && get().currentDirectory !== dirAtStart) {
          // ユーザー切替が発生し、かつ現在ディレクトリが元と異なる (切替→復帰ではない) 場合、
          // 旧ディレクトリ向けの孤児セッションをベストエフォートで削除し、作成されなかった
          // (null) を返す (#71)
          void api.sessions.remove(s.id).catch(() => {
            /* 削除失敗はサーバ側に残るだけ (次回 loadSessions で旧ディレクトリに現れる) */
          });
          return null;
        }
        saveAgentMode(s.id, pendingMode);
        set((st) => ({
          sessions: [s, ...st.sessions],
          currentId: s.id,
          messages: [],
          tools: [],
          agentMode: pendingMode,
          sessionCreateSeq: st.sessionCreateSeq + 1,
        }));
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
    })();
    const wrapped = run.finally(() => {
      if (get().inFlightCreatePromise === wrapped) set({ inFlightCreatePromise: null });
    });
    set({ inFlightCreatePromise: wrapped });
    return wrapped;
  },

  selectSession: async (id) => {
    // messagesLoadingId を同期設定し、loadMessages 起動前の数マイクロ秒 (未読込) でも
    // createSession が当該セッションを誤って流用判定しないようにする (#71)
    set({
      currentId: id,
      messages: [],
      tools: [],
      messagesLoadingId: id,
      agentMode: loadAgentMode(id),
    });
    await get().loadMessages(id);
  },

  deleteSession: async (id) => {
    await api.sessions.remove(id);
    unmarkTouched(id);
    sendGenBySession.delete(id);
    // セッション単位のモード (agentMode) の localStorage キーも掃除する (Gate 1 指摘対応)
    try {
      localStorage.removeItem(`${AGENT_MODE_PREFIX}${id}`);
    } catch {
      /* storage unavailable */
    }
    set((st) => ({
      sessions: st.sessions.filter((s) => s.id !== id),
      pinned: st.pinned.filter((p) => p !== id),
      currentId: st.currentId === id ? null : st.currentId,
      messages: st.currentId === id ? [] : st.messages,
      // 現行セッション削除で未選択に戻る場合はモードも既定へ戻す (次回送信に古いモードが
      // 残らないようにする — Gate 1 指摘対応)。非現行の削除では現行モードを維持する
      agentMode: st.currentId === id ? DEFAULT_AGENT_MODE : st.agentMode,
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
    // 複製元セッション (id) のエージェントモードを複製先へ引き継ぐ (Issue #72)。
    // 現行セッションのモード (get().agentMode) ではなく対象セッションの永続化済みモードを
    // 読む (非現行セッションの複製時も正しく引き継ぐため — Gate 1 指摘対応)
    const copiedMode = loadAgentMode(id);
    saveAgentMode(session.id, copiedMode);
    set((st) => ({
      sessions: [session, ...st.sessions],
      currentId: session.id,
      messages: [],
      agentMode: copiedMode,
    }));
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

  selectedModel: null,
  enableOrchestration: false,
  loadRuntimeSettings: async () => {
    try {
      const s = await api.settings.get();
      const raw = s.selectedModel;
      if (raw) {
        const parsed = JSON.parse(raw) as { providerID?: string; modelID?: string };
        if (parsed && typeof parsed.providerID === 'string' && typeof parsed.modelID === 'string') {
          set({ selectedModel: { providerID: parsed.providerID, modelID: parsed.modelID } });
        }
      } else {
        set({ selectedModel: null });
      }
      // オーケストレーション有効時は明示モデル選択と排他 (両立させない — Issue #62)
      const orchestration = s.enableOrchestration === 'true';
      if (orchestration) set({ selectedModel: null });
      set({ enableOrchestration: orchestration });
      if (settingsRetryTimer) {
        clearTimeout(settingsRetryTimer);
        settingsRetryTimer = null;
      }
      settingsRetries = 0;
    } catch {
      // BFF 未起動等で取得失敗時は既定 (null/false) のままとし、起動直後の復旧のため自動再取得。
      // 進行中の再試行があれば重複スケジュールしない
      if (settingsRetryTimer) return;
      settingsRetries += 1;
      if (settingsRetries < SETTINGS_MAX_RETRIES) {
        settingsRetryTimer = setTimeout(() => {
          settingsRetryTimer = null;
          void get().loadRuntimeSettings();
        }, SETTINGS_RETRY_DELAY_MS);
      }
    }
  },
  setSelectedModel: async (m, opts) => {
    // 明示モデル選択時はオーケストレーションを排他 OFF にし、両キーを 1 PUT で原子更新する
    // (Header からの連続 PUT による selectedModel 空上書きの競合を防ぐ — Issue #62)
    const nextOrchestration = m ? false : get().enableOrchestration;
    set({ selectedModel: m, enableOrchestration: nextOrchestration });
    if (opts?.persist === false) return;
    try {
      await api.settings.put({
        selectedModel: m ? JSON.stringify(m) : '',
        enableOrchestration: String(nextOrchestration),
      });
    } catch {
      /* 永続化失敗は無視 (セッション内では有効) */
    }
  },
  setEnableOrchestration: async (v) => {
    // オーケストレーション有効時は明示モデル選択と排他 (Issue #62)。
    // 有効化する際に選択中だったモデルは localStorage へ退避し、無効化時に復元する
    // (単純に null 化してしまうと切替前のモデルが永久に失われるため — Gate 2 指摘)
    if (v) {
      const current = get().selectedModel;
      if (current) localStorage.setItem(ORCH_MODEL_STASH_KEY, JSON.stringify(current));
      set({ enableOrchestration: true, selectedModel: null });
      try {
        await api.settings.put({ enableOrchestration: 'true', selectedModel: '' });
      } catch {
        /* 永続化失敗は無視 */
      }
      return;
    }
    let restored: { providerID: string; modelID: string } | null = null;
    try {
      const raw = localStorage.getItem(ORCH_MODEL_STASH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { providerID?: string; modelID?: string };
        if (parsed && typeof parsed.providerID === 'string' && typeof parsed.modelID === 'string') {
          restored = { providerID: parsed.providerID, modelID: parsed.modelID };
        }
      }
    } catch {
      /* 退避データ破損時は復元しない */
    }
    if (restored) localStorage.removeItem(ORCH_MODEL_STASH_KEY);
    set({ enableOrchestration: false, selectedModel: restored });
    try {
      await api.settings.put({
        enableOrchestration: 'false',
        selectedModel: restored ? JSON.stringify(restored) : '',
      });
    } catch {
      /* 永続化失敗は無視 */
    }
  },

  messages: [],

  tools: [],

  agentMode: DEFAULT_AGENT_MODE,

  setAgentMode: (mode) => {
    const id = get().currentId;
    if (id) {
      saveAgentMode(id, mode);
    } else {
      // セッション未選択時はメモリ上の「次に使うセッション向け保留モード」として保持し、
      // createSession が新規セッションへ引き継ぐ (Issue #72)。
      // 既存セッションを選択した場合は各セッションの保存済みモードが優先される
      // (セッション単位の永続化契約 — Gate 1 指摘への明文化)。
    }
    set({ agentMode: mode });
  },

  loadMessages: async (id) => {
    const mySeq = ++messagesLoadSeq;
    // 読込開始時点の「このセッションの」送信世代。読込の完了が遅い間に同セッションへの
    // 送信が成功済みなら unmark を抑制する (他セッションの送信では抑制しない #71)
    const sendGenAtLoad = sendGenBySession.get(id) ?? 0;
    set({ messagesLoadingId: id });
    try {
      const entries = (await api.messages.list(id)) as OCMessageEntry[];
      // 並行読込やセッション切替による stale 結果は反映しない (最新の読込 + 現セッションのみ #71)
      if (mySeq !== messagesLoadSeq || get().currentId !== id) return;
      // サーバに履歴があるセッションは送信済みとして扱う (#71 の連打防護の判定用)。
      // 空と確定した場合は解除する — 一時的な失敗で fail-open 登録されたセッションを復元。
      // ただし、読込開始後に送信が成功していた場合 (sendGen が進んでいる) は解除しない
      // (sendMessage の markTouched を stale な空応答が巻き戻さないように #71)
      if (entries.length > 0) markTouched(id);
      else if ((sendGenBySession.get(id) ?? 0) === sendGenAtLoad) unmarkTouched(id);
      set({ messages: entriesToMessages(entries), reachable: true });
    } catch {
      if (mySeq !== messagesLoadSeq || get().currentId !== id) return;
      // 読込失敗時は空か否かを判別不能なため送信済み扱い (fail-open) にして、
      // 防護がユーザーを閉じ込めないようにする (#71)
      markTouched(id);
      set({ messages: [] });
    } finally {
      // 自分が最新の読込である場合のみフラグを戻す (古い読込が新しい読込のフラグを消さない #71)
      if (mySeq === messagesLoadSeq) set({ messagesLoadingId: null });
    }
  },

  sendMessage: async (text, attachments = []) => {
    const { currentId, createSession, messages } = get();
    // 送信開始時点のエージェントモードを捕捉する (Issue #72)。新規セッション作成の await 中に
    // モードが変動しても、送信したメッセージとセッションへ永続化されるモードを一致させる
    const modeForSend = get().agentMode;
    let id = currentId;
    if (!id) {
      try {
        const created = await createSession();
        if (!created) {
          // 作成されなかった (ディレクトリ切替等で null)。切替後に別セッションを選択済み
          // なら送信は継続され見えるため無通知、未選択なら中断を通知して返す (#71)
          const current = get().currentId;
          if (!current) {
            useUI.getState().pushToast(tr('chat.sendInterrupted'), 'info');
            return;
          }
          id = current;
        } else {
          id = created;
        }
      } catch {
        // 作成失敗時は createSession がエラートーストを表示済み → 送信を中断
        return;
      }
      // 新規セッション作成時は createSession が開始時点のモードを永続化するため、
      // 送信開始時点の捕捉値 (modeForSend) とズレた場合に補正して一貫させる
      // (既存セッションを選択済みの場合は現在値 = 捕捉値で no-op)。
      // ※ セッション作成 (await) 中にユーザーがモードを切り替えた場合、その切替は
      //   送信メッセージと永続化モードの一貫性を優先して破棄される (UI も捕捉値へ戻る)
      // id が null のまま到達した場合 (孤児整理で null 返却→送信中断経路等) は補正しない
      // (saveAgentMode(null, ...) で 'agentMode:null' を残さない — Gate 1 指摘対応)
      if (id && get().agentMode !== modeForSend) {
        saveAgentMode(id, modeForSend);
        set({ agentMode: modeForSend });
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
        // 成功後に送信済みセッションとして扱う (#71 の連打防護の判定用)。
        // markSend は stale な空応答 unmark がこのセッションのフラグを解除しないための世代
        markTouched(id);
        markSend(id);
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
    // 明示選択モデルがあれば送信に含める (無ければオーケストレーション/既定に委ねる — Issue #62)
    // この送信前のメッセージ ID 集合で「SSE 経由で応答が届いたか」を判定する
    const preMessageIds = new Set(messages.map((m) => m.id));
    try {
      await api.messages.send(id, text, get().selectedModel ?? undefined, attachments, modeForSend);
      // サーバ応答の完了 (resolve) を送信成功とみなし、後続の SSE/再同期の失敗に
      // 影響されないよう送信済みとして扱う (#71 の連打防護の判定用)。
      // await 中にセッション切替が起きた場合は markTouched 内部の currentId ガードで
      // 静かにスキップされる (再選択時の loadMessages で自己回復する)。
      // markSend は stale な空応答 unmark がこのセッションのフラグを解除しないための世代
      markTouched(id);
      markSend(id);
    } catch (e) {
      // send 自体の失敗のみエラーとして扱う (再同期失敗と混同しない)。
      // ここに到達する時点で optimistic は必ず生成済み (上記で try より前に生成。
      // セッション作成失敗はさらに手前で return するため到達しない)
      // サーバ側に永続化済みの曖昧な失敗 (ネットワーク切断・5xx・408/429) では再同期を試みる。
      // 決定的な失敗 (400-499 のうち 408/429 を除く) は受付前に拒否されるため永続化されて
      // おらず再同期は不要。再同期完了まで busy を維持して並行送信との競合を防ぐ
      // (成功パスと同じ順序: resync → busy 解除)
      const status = e instanceof ApiError ? e.status : 0;
      const isDeterministic = status >= 400 && status < 500 && status !== 408 && status !== 429;
      // 再同期で「この送信」のサーバメッセージが新規に増えたかを判定するための事前 ID 集合。
      // 過去に同一テキストを送信済みでも、事前 ID 集合に含まれるため誤マッチしない
      const preResyncIds = new Set(get().messages.map((m) => m.id));
      if (!isDeterministic) {
        await resyncMessages(id);
      }
      // 再同期で今回の送信がサーバ側に永続化された (local-* 以外の新規 user メッセージ) 場合は
      // 失敗トーストを出さない (重複送信を誘発しないため)
      const restored = get().messages.some(
        (m) =>
          m.role === 'user' &&
          !m.id.startsWith('local-') &&
          !preResyncIds.has(m.id) &&
          m.text === text,
      );
      if (!restored) {
        const detail = e instanceof Error ? e.message : String(e);
        useUI.getState().pushToast(`${tr('chat.sendFailed')}: ${detail}`, 'error');
      }
      set((st) => ({ messages: st.messages.filter((m) => m.id !== optimistic.id), busy: false }));
      return;
    }
    // SSE イベント欠落時 (agent-core 再起動等で EventSource が黙って死ぬケース) の
    // フォールバック: この送信のアシスタント応答が表示されていない場合のみサーバから再同期する。
    // 再同期はベストエフォート (タイムアウト付き) で、busy の解放を妨げない。
    // ※ SSE が単に遅延している場合は後続の message.updated / message.part.updated が
    //   applySSE の id ベース upsert で同じメッセージに適用されるため重複は発生しない
    const hasNewAssistant = get().messages.some(
      (m) => m.role === 'assistant' && !preMessageIds.has(m.id),
    );
    if (!hasNewAssistant) {
      // resyncMessages はサーバの実メッセージで置換しつつ、送信途中の楽観的メッセージ
      // (local-* のクライアント ID) は保持する
      await resyncMessages(id);
    }
    // busy はサーバ応答の生成完了後に解除する (api.messages.send は応答完了までブロックする)
    set({ busy: false });
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
    // 再生成も現行セッションのエージェントモードで送信する (セッション単位のモード契約 —
    // Issue #72)。元メッセージ生成時とモードが異なる場合に再生成内容の意味が変わり得るが、
    // これは「セッションの現在モード」が再生成にも適用される意図的な挙動
    await api.messages.send(
      currentId,
      newText,
      get().selectedModel ?? undefined,
      undefined,
      get().agentMode,
    );
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
