/**
 * PWA インストール支援の純関数テスト (Issue #66)
 * isIOS / isStandaloneView はグローバル (navigator / window / matchMedia) に依存するため、
 * グローバルを差し替えて検証する。polyfill-localStorage に続いて polyfill-window を
 * 先に import する (ESM の評価順を利用)。
 * 実行: pnpm --filter @ame-agent-chat/frontend test
 */
import './polyfill-localStorage';
import './polyfill-window';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  getCapturedPromptEvent,
  isIOS,
  isInstalledPersisted,
  isStandaloneView,
  shouldShowInstallPrompt,
  subscribeCapture,
} from '../src/lib/pwa';

const originalUserAgent = Object.getOwnPropertyDescriptor(navigator, 'userAgent');
const originalMaxTouchPoints = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints');
const originalStandalone = Object.getOwnPropertyDescriptor(navigator, 'standalone');
const originalMatchMedia = window.matchMedia;

function setUA(ua: string): void {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua });
}

function setMaxTouchPoints(n: number): void {
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: n });
}

function setStandaloneMeta(standalone: boolean): void {
  Object.defineProperty(navigator, 'standalone', { configurable: true, value: standalone });
}

function setDisplayMode(mode: string): void {
  const mql = { matches: mode === 'standalone' } as MediaQueryList;
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  if (originalUserAgent) Object.defineProperty(navigator, 'userAgent', originalUserAgent);
  if (originalMaxTouchPoints)
    Object.defineProperty(navigator, 'maxTouchPoints', originalMaxTouchPoints);
  else delete (navigator as unknown as Record<string, unknown>)['maxTouchPoints'];
  if (originalStandalone) Object.defineProperty(navigator, 'standalone', originalStandalone);
  else delete (navigator as unknown as Record<string, unknown>)['standalone'];
  window.matchMedia = originalMatchMedia;
});

test('isIOS: iPhone / iPad は true、デスクトップは false', () => {
  setUA(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  );
  setMaxTouchPoints(5);
  assert.equal(isIOS(), true);

  setUA('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148');
  assert.equal(isIOS(), true);

  // iPad のデスクトップ表示 (Macintosh UA + touch) も iOS 扱い
  setUA('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Mobile/15E148');
  setMaxTouchPoints(5);
  assert.equal(isIOS(), true);

  // 通常のデスクトップは false
  setUA('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36');
  setMaxTouchPoints(0);
  assert.equal(isIOS(), false);
});

test('isStandaloneView: navigator.standalone または display-mode:standalone で true', () => {
  setDisplayMode('standalone');
  setStandaloneMeta(false);
  assert.equal(isStandaloneView(), true);

  setDisplayMode('browser');
  setStandaloneMeta(true);
  assert.equal(isStandaloneView(), true);

  setDisplayMode('browser');
  setStandaloneMeta(false);
  assert.equal(isStandaloneView(), false);
});

test('shouldShowInstallPrompt: 表示判定が状態の組み合わせを正しく反映する', () => {
  const base = {
    canInstall: false,
    isIOS: false,
    isStandalone: false,
    installed: false,
    dismissed: false,
  };
  // Chrome/Edge 等でプロンプト発火可能なら表示
  assert.equal(shouldShowInstallPrompt({ ...base, canInstall: true }), true);
  // iOS は手動案内のため canInstall 不要で表示
  assert.equal(shouldShowInstallPrompt({ ...base, isIOS: true }), true);
  // インストール済み (standalone) なら非表示
  assert.equal(shouldShowInstallPrompt({ ...base, canInstall: true, isStandalone: true }), false);
  assert.equal(shouldShowInstallPrompt({ ...base, isIOS: true, isStandalone: true }), false);
  // インストール完了・バナーを閉じた場合は非表示
  assert.equal(shouldShowInstallPrompt({ ...base, canInstall: true, installed: true }), false);
  assert.equal(shouldShowInstallPrompt({ ...base, canInstall: true, dismissed: true }), false);
});

test('isInstalledPersisted: localStorage のインストール済みフラグを読み取り、期限切れで無効化する', () => {
  localStorage.removeItem('pwaInstalled');
  assert.equal(isInstalledPersisted(), false);

  const now = Date.now();
  localStorage.setItem('pwaInstalled', String(now - 1000));
  assert.equal(isInstalledPersisted(now), true);

  // 31 日経過 (30 日 TTL 超過) でフラグが期限切れになり false を返し、保存値も削除される
  const later = now + 31 * 24 * 60 * 60 * 1000;
  assert.equal(isInstalledPersisted(later), false);
  assert.equal(localStorage.getItem('pwaInstalled'), null, '期限切れフラグが削除されること');

  localStorage.removeItem('pwaInstalled');
});

test('capture: beforeinstallprompt 発火で購読者が通知されイベントが捕捉される', () => {
  // 捕捉判定は storage 状態に依存するため、先行テストの影響を受けないよう初期化する
  localStorage.removeItem('pwaInstallDismissed');
  localStorage.removeItem('pwaInstalled');
  localStorage.removeItem('pwaInstallPromptDismissed');
  try {
    sessionStorage.removeItem('pwaInstallPromptDismissed');
  } catch {
    /* storage unavailable */
  }

  let notified = 0;
  const unsub = subscribeCapture(() => {
    notified += 1;
  });

  const Evt = globalThis.Event ?? class extends Object {};
  const evt = new Evt('beforeinstallprompt', { cancelable: true });
  const notPrevented = window.dispatchEvent(evt);
  // 未インストール・未クローズ状態ならネイティブ導線を抑止して捕捉する
  assert.equal(notPrevented, false, '標準プロンプトが抑止されること');
  assert.equal(notified, 1, '購読者へ捕捉通知が届くこと (イベント毎に1回)');
  assert.ok(getCapturedPromptEvent(), 'イベントが捕捉されること');

  // 再発火イベントでも最新イベントへ更新して通知される (古いイベントで失敗しない)
  const evt2 = new Evt('beforeinstallprompt', { cancelable: true });
  const notPrevented2 = window.dispatchEvent(evt2);
  assert.equal(notPrevented2, false, '再発火イベントも抑止されること');
  assert.equal(notified, 2, '再発火でも購読者へ通知されること');

  unsub();
});
