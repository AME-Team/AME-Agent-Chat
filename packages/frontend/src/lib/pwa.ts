/**
 * PWA インストール支援 (Issue #66 / 要件 #1 §3.1.6)
 * ・beforeinstallprompt の捕捉と手動プロンプト発火 (Chrome / Edge / Android)
 * ・iOS Safari はイベント非対応のため「ホーム画面に追加」手順を案内
 * ・standalone 表示中 / インストール済み / ユーザーが閉じた場合は非表示
 *
 * beforeinstallprompt は SW/マニフェストがキャッシュ済みの再訪時に React マウントへ
 * 先行して発火し得るため、リスナーはモジュール初期化時に登録する (早期捕捉)。
 * ここで保持したイベントを hook 側 (useInstallPrompt) から使う。
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Chrome / Edge / Android のインストールプロンプトイベント */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'pwaInstallDismissed';
const INSTALLED_KEY = 'pwaInstalled';
// インストール済み/クローズの永続フラグ共通の有効期限 (30 日)
const FLAG_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// ネイティブプロンプトを却下 (dismissed) した際に再案内しないためのキー。
// sessionStorage は同一タブ内ではリロードを跨いでも保持されるため、新規タブ/ウィンドウを
// 開き直したセッションでのみ再案内される (明示的な却下の尊重を優先)。
const PROMPT_DISMISSED_KEY = 'pwaInstallPromptDismissed';

/** モジュール初期化時に捕捉した未使用の beforeinstallprompt イベント (早期捕捉用) */
let capturedPromptEvent: BeforeInstallPromptEvent | null = null;
/** モジュールレベルのリスナーが登録済みかを示すフラグ (Vite HMR の再評価で二重登録しない) */
let moduleListenerRegistered = false;
/** beforeinstallprompt 捕捉を購読するハンドラ一覧 (フックが受信する) */
const captureListeners = new Set<() => void>();

/** 捕捉済みイベントを返す (フックが初期値・購読で参照する) */
export function getCapturedPromptEvent(): BeforeInstallPromptEvent | null {
  return capturedPromptEvent;
}

/** beforeinstallprompt 捕捉の購読登録 (フックがこれで state を同期する) */
export function subscribeCapture(listener: () => void): () => void {
  captureListeners.add(listener);
  return () => captureListeners.delete(listener);
}

function notifyCaptureChange(): void {
  captureListeners.forEach((listener) => listener());
}

/** localStorage から時限フラグを読み取る (同期・例外安全) */
function readTimestampFlag(key: string, now = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const stored = Number(raw);
    if (!Number.isFinite(stored) || stored <= 0) return false;
    if (now - stored >= FLAG_TTL_MS) {
      localStorage.removeItem(key);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** カスタムバナーを表示する状況か (ネイティブプロンプトを抑止すべきか) を同期判定する */
function shouldCapturePrompt(): boolean {
  const now = Date.now();
  let promptDismissed = false;
  try {
    promptDismissed = sessionStorage.getItem(PROMPT_DISMISSED_KEY) === '1';
  } catch {
    /* storage unavailable */
  }
  const dismissed = readTimestampFlag(DISMISS_KEY, now) || promptDismissed;
  const installed = readTimestampFlag(INSTALLED_KEY, now);
  const standalone = isStandaloneViewSync();
  return !dismissed && !installed && !standalone;
}

/**
 * スタンドアロン表示中の同期判定 (window.matchMedia は同期的に取得可能)。
 * isStandaloneView の非同期フック版と分離し、イベントリスナー内からでも使えるようにする。
 */
export function isStandaloneViewSync(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return standalone || window.matchMedia('(display-mode: standalone)').matches;
}

// beforeinstallprompt の唯一の捕捉点。ここで preventDefault の分岐 (shouldCapturePrompt) を
// 一本化し、捕捉イベントを capturedPromptEvent へ格納したうえで購読者 (フック) へ通知する。
// フック側はこれを受信し、自前の beforeinstallprompt リスナーを持たない (単一責任・ドリフト防止)。
function onBeforeInstallPromptLocal(e: Event): void {
  // カスタムバナーを表示する状況のみブラウザ標準プロンプトを抑止して捕捉する。
  // バナー非表示 (dismissed / installed / standalone) のときはネイティブ導線を残す
  // (無条件 preventDefault でインストール機会を失わないようにする)。
  if (!shouldCapturePrompt()) return;
  e.preventDefault();
  // 毎回イベントを更新して購読者へ通知する。beforeinstallprompt は再発火し得るため、
  // 最新イベントを保持し古いイベント (prompt 済み) で失敗しないようにする。
  capturedPromptEvent = e as BeforeInstallPromptEvent;
  notifyCaptureChange();
}

// モジュール読み込み時点でリスナーを登録し、React マウント前に発火するイベントを捕捉する。
// window が無い環境 (SSR / テストの Node) では何もしない。Vite HMR 等の再評価で
// 重複登録しないよう、登録済みフラグでガードする。
if (typeof window !== 'undefined' && !moduleListenerRegistered) {
  moduleListenerRegistered = true;
  window.addEventListener('beforeinstallprompt', onBeforeInstallPromptLocal);
}

/**
 * バナーを表示すべきかの判定 (純関数・テスト可能)
 * - 非 standalone かつ未インストールかつ未クローズのとき表示候補
 * - 表示候補のうえで「プロンプト発火可能 (Chrome 等)」または「iOS (手動案内)」なら表示
 */
export function shouldShowInstallPrompt(params: {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  installed: boolean;
  dismissed: boolean;
}): boolean {
  return (
    !params.isStandalone &&
    !params.installed &&
    !params.dismissed &&
    (params.canInstall || params.isIOS)
  );
}

/** iOS (iPhone / iPad) かどうか。beforeinstallprompt 非対応のため手動案内が必要 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPad はデスクトップ化されると Macintosh 扱いになるため touch 有無でも判定する
  return /iPhone|iPod|iPad/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
}

/** スタンドアロン (インストール済みアプリ) として表示中か */
export function isStandaloneView(): boolean {
  return isStandaloneViewSync();
}

/**
 * インストール済みかどうかの永続初期値 (localStorage)。
 * ・appinstalled イベントはインストールした通常タブでは再発火しないため、
 *   フラグを localStorage へ永続化して通常ブラウザでの再訪で再案内しないようにする。
 * ・アンインストール後の再案内を可能にするため、記録時点から FLAG_TTL_MS のみ有効
 *   (期限切れ時はフラグを削除して未インストール扱いに戻す)。
 */
export function isInstalledPersisted(now = Date.now()): boolean {
  return readTimestampFlag(INSTALLED_KEY, now);
}

/** local ストレージに時限フラグを書き込む (タイムスタンプ形式) */
function persistFlag(key: string): void {
  try {
    localStorage.setItem(key, String(Date.now()));
  } catch {
    /* storage unavailable */
  }
}

export interface InstallPromptState {
  /** Chrome 等でプロンプト発火可能か */
  canInstall: boolean;
  /** iOS 端末か */
  isIOS: boolean;
  /** インストール済み (standalone) 表示中か */
  isStandalone: boolean;
  /** バナーを表示すべきか */
  show: boolean;
  /** バナーを閉じる (localStorage へ永続化) */
  dismiss: () => void;
  /** インストールプロンプト発火 (iOS は 'unavailable' を返し案内のみ) */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function useInstallPrompt(): InstallPromptState {
  const eventRef = useRef<BeforeInstallPromptEvent | null>(getCapturedPromptEvent());
  const [canInstall, setCanInstall] = useState(() => getCapturedPromptEvent() !== null);
  const [installed, setInstalled] = useState(() => isInstalledPersisted());
  const [isIOSDevice] = useState(() => isIOS());
  const [standalone, setStandalone] = useState(() => isStandaloneView());
  const [dismissed, setDismissed] = useState(() => {
    // バナーを閉じた (localStorage・時限) か、ネイティブプロンプトを却下した (sessionStorage) 場合は非表示
    const now = Date.now();
    try {
      return (
        readTimestampFlag(DISMISS_KEY, now) || sessionStorage.getItem(PROMPT_DISMISSED_KEY) === '1'
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // モジュールリスナーが唯一の捕捉点。購読して、マウント前 (早期捕捉) に加え
    // マウント後に捕捉されたイベントも state/ref へ同期する (単一情報源での駆動)。
    const syncCaptured = () => {
      const evt = getCapturedPromptEvent();
      if (evt) {
        eventRef.current = evt;
        setCanInstall(true);
      }
    };
    syncCaptured();
    const unsubscribe = subscribeCapture(syncCaptured);

    const onInstalled = () => {
      setInstalled(true);
      persistFlag(INSTALLED_KEY);
    };
    const onDisplayMode = () => setStandalone(isStandaloneView());

    const mql = window.matchMedia('(display-mode: standalone)');
    // addEventListener は Safari 14+ のみ。それ以前は非推奨の addListener へフォールバックする。
    // リスナー登録 API の有無は呼び出し前に確認する (未対応環境で addListener がない場合は無視)。
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onDisplayMode);
    } else if (typeof mql.addListener === 'function') {
      mql.addListener(onDisplayMode);
    }

    window.addEventListener('appinstalled', onInstalled);
    return () => {
      unsubscribe();
      window.removeEventListener('appinstalled', onInstalled);
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', onDisplayMode);
      } else if (typeof mql.removeListener === 'function') {
        mql.removeListener(onDisplayMode);
      }
    };
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    persistFlag(DISMISS_KEY);
  }, []);

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const evt = eventRef.current;
    if (!evt) return 'unavailable'; // iOS 等は「ホーム画面に追加」の手動案内のみ
    try {
      await evt.prompt();
    } catch {
      // ユーザー操作の喪失等で prompt() が失敗しても UI を壊さない (Unhandled Rejection 防止)。
      // イベント/状態は破棄せず、再度「インストール」を押せる状態を保つ。
      return 'unavailable';
    }
    const choice = await evt.userChoice;
    // beforeinstallprompt は one-shot 契約。結果確定後にイベントを破棄し再表示時に再取得を待つ
    eventRef.current = null;
    capturedPromptEvent = null;
    setCanInstall(false);
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      persistFlag(INSTALLED_KEY);
    }
    // 却下時はセッション内で再案内しない (新規タブ/ウィンドウのセッションでは再案内)
    if (choice.outcome === 'dismissed') {
      setDismissed(true);
      try {
        sessionStorage.setItem(PROMPT_DISMISSED_KEY, '1');
      } catch {
        /* storage unavailable */
      }
    }
    return choice.outcome;
  }, []);

  const show = shouldShowInstallPrompt({
    canInstall,
    isIOS: isIOSDevice,
    isStandalone: standalone,
    installed,
    dismissed,
  });

  return { canInstall, isIOS: isIOSDevice, isStandalone: standalone, show, dismiss, promptInstall };
}
