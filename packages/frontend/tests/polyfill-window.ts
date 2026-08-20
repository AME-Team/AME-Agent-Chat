/**
 * pwa.test.ts 用の window / navigator ポリフィル (Node 環境)
 * ・window が無い環境向けに matchMedia / addEventListener / removeEventListener /
 *   dispatchEvent を注入する (beforeinstallprompt 等の捕捉テスト用にリスナーを保持)
 * ・navigator が無い環境 (Node 21 未満等) 向けにダミー navigator を注入する
 * ・既存の window / navigator は上書きしない (Node 21+ は navigator が既に存在する)
 * ESM の import 評価順を利用して、pwa.test のモジュール読み込みより先に実行される。
 */
const mql = { matches: false, media: '' } as MediaQueryList;
const w: Record<string, unknown> =
  (globalThis as unknown as Record<string, unknown>)['window'] ?? {};

const listeners = new Map<string, Set<(e: Event) => void>>();
w['addEventListener'] ??= (type: string, fn: (e: Event) => void) => {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type)!.add(fn);
};
w['removeEventListener'] ??= (type: string, fn: (e: Event) => void) => {
  listeners.get(type)?.delete(fn);
};
w['dispatchEvent'] ??= (e: Event) => {
  listeners.get(e.type)?.forEach((fn) => fn(e));
  return !e.defaultPrevented;
};
w['matchMedia'] ??= () => mql;
(globalThis as unknown as Record<string, unknown>)['window'] = w;

// 既存の navigator が DOM 契約を満たさない場合のみダミーを注入する。上書き時は常に同一形にする。
const globalNav = globalThis as unknown as { navigator?: { userAgent?: string } };
if (!globalNav.navigator || typeof globalNav.navigator.userAgent !== 'string') {
  (globalThis as unknown as Record<string, unknown>)['navigator'] = {
    userAgent: 'Node.js',
    maxTouchPoints: 0,
  };
}
