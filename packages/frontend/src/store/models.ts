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
  retries: number;
  load: () => Promise<void>;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

/** 進行中の再試行タイマー (重複スケジュール防止 — Issue #62) */
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export const useModels = create<ModelsState>((set, get) => ({
  options: [],
  loaded: false,
  retries: 0,

  load: async () => {
    if (get().loaded) return;
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
      set({ options, loaded: true, retries: 0 });
    } catch {
      // 起動直後のサーバ未達に備えて自動再試行しつつ、失敗後も loaded を立てない。
      // これによりドロップダウン再オープン等の再取得契機でモデル一覧を回復できる。
      // 進行中の再試行があれば重複スケジュールしないよう 1 件に制限する
      if (retryTimer) return;
      set({ retries: get().retries + 1 });
      if (get().retries < MAX_RETRIES) {
        retryTimer = setTimeout(() => {
          retryTimer = null;
          void get().load();
        }, RETRY_DELAY_MS);
      }
    }
  },
}));
