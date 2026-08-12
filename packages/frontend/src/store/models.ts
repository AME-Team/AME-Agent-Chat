/**
 * モデル一覧ストア (Issue #62)
 * opencode が提供するプロバイダー×モデルを取得してキャッシュする。
 * ヘッダーのモデル選択に利用する (通常のモデル選択 = オーケストレーション無し)。
 */
import { create } from 'zustand';
import { api } from '../lib/api';

export interface ModelOption {
  providerID: string;
  modelID: string;
  label: string;
}

interface ModelsState {
  options: ModelOption[];
  /** 初回取得が一度でも成功したか (失敗時は false のまま → 再取得可能) */
  loaded: boolean;
  /** 再試行上限に達し、自動再取得を打ち切ったか */
  failed: boolean;
  retries: number;
  /** モデル一覧を取得する。force=true は手動回復 (ドロップダウン再フォーカス等) を表し、
   *  failed (再試行上限) を解除して必ず取得を試みる (retries は維持し自動再試行を復活させない) */
  load: (force?: boolean) => Promise<void>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/** 進行中の再試行タイマー (重複スケジュール防止 — Issue #62) */
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export const useModels = create<ModelsState>((set, get) => ({
  options: [],
  loaded: false,
  failed: false,
  retries: 0,

  load: async (force = false) => {
    // 成功済みは即 return。自動再試行は上限到達後 (failed) で止めるが、
    // 手動 (force: ドロップダウン再フォーカス等) は failed を解除して回復経路を維持する
    if (get().loaded) return;
    if (!force && get().failed) return;
    if (force) {
      // 保留中の自動再試行タイマーは破棄して手動取得を即時発行する (タイミング依存を排除)。
      // なお failed は解除するが retries は維持し、失敗が続く場合の断続リクエストを防ぐ
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      set({ failed: false });
    }
    try {
      // GET /api/models は agent-core (routes/models.ts, 既存実装) が
      // opencode の config/providers を返す ({"providers":[{id, models}]})
      const res = await api.models.list();
      const options: ModelOption[] = [];
      for (const p of res.providers ?? []) {
        for (const modelID of Object.keys(p.models ?? {})) {
          options.push({ providerID: p.id, modelID, label: `${p.id}/${modelID}` });
        }
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      set({ options, loaded: true, retries: 0, failed: false });
    } catch {
      // 起動直後のサーバ未達に備えて自動再試行する (上限までは失敗後も再取得契機で回復を試みる)。
      // 進行中の再試行があれば重複スケジュールしないよう 1 件に制限する
      if (retryTimer) return;
      // retries は MAX で頭打ちにし、手動再試行の失敗で無制限に増えないようにする
      set({ retries: Math.min(get().retries + 1, MAX_RETRIES) });
      if (get().retries >= MAX_RETRIES) {
        // 上限到達: 自動再試行は failed で打ち切る。ただし手動回復経路 (ドロップダウン
        // 再フォーカス時は Header が force=true で呼び、failed を解除する) は維持する
        set({ failed: true });
        return;
      }
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void get().load();
      }, RETRY_DELAY_MS);
    }
  },
}));
