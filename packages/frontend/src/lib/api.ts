/**
 * Agent Core (BFF) API クライアント (要件 #1 §2.6)
 *
 * 開発時は Vite プロキシで /api -> http://localhost:30010 へ中継 (vite.config.ts)。
 */

/** API エラー (HTTP ステータス + レスポンス本文を保持) */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(path: string, status: number, body: unknown) {
    super(`API ${path} failed: ${status} ${JSON.stringify(body)}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch (cause) {
    // Agent Core 自体に到達できないネットワークエラーは status 0 として正規化 (#44)
    throw new ApiError(path, 0, { error: 'network unreachable', cause: String(cause) });
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(path, res.status, body);
  }
  return res.json() as Promise<T>;
}

/** OpenCode Session をアプリ向けに整形 */
export interface AppSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface OpencodeSession {
  id: string;
  title: string;
  time: { created: number; updated: number };
}

function toAppSession(s: OpencodeSession): AppSession {
  return {
    id: s.id,
    title: s.title,
    createdAt: new Date(s.time.created).toISOString(),
    updatedAt: new Date(s.time.updated).toISOString(),
  };
}

export const api = {
  health: () => request<{ status: string; opencode: string }>('/health'),

  sessions: {
    list: () => request<OpencodeSession[]>('/api/sessions').then((ss) => ss.map(toAppSession)),
    create: (title?: string) =>
      request<OpencodeSession>('/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ title }),
      }).then(toAppSession),
    update: (id: string, title: string) =>
      request<OpencodeSession>(`/api/sessions/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }).then(toAppSession),
    remove: (id: string) => request<{ ok: boolean }>(`/api/sessions/${id}`, { method: 'DELETE' }),
    /** セッション複製 (#2 §2.1) — messageID 地点でフォーク */
    fork: (id: string, messageID?: string) =>
      request<OpencodeSession>(`/api/sessions/${id}/fork`, {
        method: 'POST',
        body: JSON.stringify({ messageID }),
      }).then(toAppSession),
    share: (id: string) =>
      request<{ url?: string }>(`/api/sessions/${id}/share`, { method: 'POST' }),
    unshare: (id: string) =>
      request<{ url?: string }>(`/api/sessions/${id}/unshare`, { method: 'POST' }),
  },

  search: {
    /** Gatekeeper のタイトル+メッセージ内容 全文検索 (#2 §2.3) */
    sessions: (q: string) => request<unknown[]>(`/api/search?q=${encodeURIComponent(q)}`),
  },

  importSession: (data: { title: string; messages: Array<{ role: string; text: string }> }) =>
    request<{ id: string }>('/api/import', { method: 'POST', body: JSON.stringify(data) }),

  messages: {
    list: (id: string) => request<unknown[]>(`/api/sessions/${id}/messages`),
    send: (
      id: string,
      text: string,
      model?: { providerID: string; modelID: string },
      attachments?: Array<{ mime: string; url: string; filename?: string }>,
    ) =>
      request(`/api/sessions/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text, model, attachments }),
      }),
    abort: (id: string) =>
      request<{ ok: boolean }>(`/api/sessions/${id}/abort`, { method: 'POST' }),
    command: (id: string, command: string, args = '') =>
      request(`/api/sessions/${id}/command`, {
        method: 'POST',
        body: JSON.stringify({ command, arguments: args }),
      }),
    revert: (id: string, messageID: string) =>
      request(`/api/sessions/${id}/revert`, {
        method: 'POST',
        body: JSON.stringify({ messageID }),
      }),
    unrevert: (id: string) => request(`/api/sessions/${id}/unrevert`, { method: 'POST' }),
    diff: (id: string) => request<unknown[]>(`/api/sessions/${id}/diff`),
    /** !Bash: サンドボックス内でコマンド実行 (#2 §3.3) */
    bash: (id: string, command: string) =>
      request<{ bash: { command: string; output: unknown } }>(`/api/sessions/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: `!${command}` }),
      }),
  },

  files: {
    /** @ファイル参照のあいまい検索 (#2 §3.3) */
    search: (q: string) => request<string[]>(`/api/files?q=${encodeURIComponent(q)}`),
  },
  cwd: {
    /** カレントディレクトリ + 選択可能なプロジェクト一覧 (#56) */
    get: (init?: RequestInit) =>
      request<{ current: string; projects: string[]; ready: boolean; settingsOk: boolean }>(
        '/api/cwd',
        init,
      ),
    /** ディレクトリを選択 (#56) */
    set: (directory: string) =>
      request<{ current: string }>('/api/cwd', {
        method: 'POST',
        body: JSON.stringify({ directory }),
      }),
  },

  auth: {
    providers: () =>
      request<{ providers: unknown[]; authMethods: Record<string, unknown[]> }>(
        '/api/auth/providers',
      ),
    login: (provider: string, method = 0) =>
      request(`/api/auth/login`, { method: 'POST', body: JSON.stringify({ provider, method }) }),
  },

  permissions: {
    /** 承認/拒否/ホワイトリスト化 (#2 §7.2) */
    decide: (id: string, approved: boolean, whitelist: boolean, sessionId: string) =>
      request<{ ok: boolean; response: string }>(`/api/permissions/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ approved, whitelist, sessionId }),
      }),
    /** 承認履歴 (監査性 #2 §7.2) */
    history: (limit = 50) => request<unknown[]>(`/api/permissions/history?limit=${limit}`),
  },

  settings: {
    get: () => request<Record<string, string>>('/api/settings'),
    put: (body: Record<string, string>) =>
      request<{ ok: boolean }>('/api/settings', { method: 'PUT', body: JSON.stringify(body) }),
  },

  usage: {
    /** トークン使用量・コスト (#27, #1 §3.2.5) */
    get: () =>
      request<
        Array<{
          provider: string;
          model: string;
          inputTokens: number;
          outputTokens: number;
          cost: number;
        }>
      >('/api/usage'),
  },

  ogp: {
    /** OGP リンクプレビュー (#2 §4.2) */
    get: (url: string) =>
      request<{ url: string; title?: string; description?: string; image?: string }>(
        `/api/ogp?url=${encodeURIComponent(url)}`,
      ),
  },
};
