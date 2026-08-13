/**
 * Node 実行環境 (node:test) には localStorage が無いため、store モジュールの
 * 初期化前にグローバルへポリフィルを注入する。ESM では import の評価順で
 * 本モジュールが store より先に実行される。DOM の Storage 契約
 * (getItem/setItem/removeItem/clear/key/length) を満たす。
 */
const storage = new Map<string, string>();
(globalThis as unknown as Record<string, unknown>).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => storage.set(k, v),
  removeItem: (k: string) => storage.delete(k),
  clear: () => storage.clear(),
  key: (i: number) => [...storage.keys()][i] ?? null,
  get length() {
    return storage.size;
  },
};
