/**
 * Agent Core (BFF) API クライアント (要件 #1 §2.6)
 *
 * 開発時は Vite プロキシで /api -> http://localhost:30010 へ中継 (vite.config.ts)。
 */

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`API ${path} failed: ${res.status} ${JSON.stringify(body)}`);
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
  },

  messages: {
    list: (id: string) => request<unknown[]>(`/api/sessions/${id}/messages`),
    send: (id: string, text: string, model?: { providerID: string; modelID: string }) =>
      request(`/api/sessions/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text, model }),
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
};
