/**
 * メッセージ・コマンド API (要件 #2 §3.1, §4, §5, §6)
 *
 *  - GET   /api/sessions/:id/messages        メッセージ一覧 (#2 §4)
 *  - POST  /api/sessions/:id/messages        プロンプト送信 (#2 §3.1)
 *      body.model を与えると LLM ルーター(#15)の選択結果を注入 (#1 §2.3)
 *  - POST  /api/sessions/:id/abort           生成停止 (#2 §5)
 *  - POST  /api/sessions/:id/command         スラッシュコマンド実行 (#2 §6)
 *  - POST  /api/sessions/:id/summarize       /compact (#2 §5, §6)
 *  - POST  /api/sessions/:id/init            /init (#2 §6)
 */
import type { Hono } from 'hono';
import { lookup } from 'node:dns/promises';
import { callOpencode, getOpencodeClient } from '../opencode.js';
import { env } from '../env.js';
import { resolveTaskModel, shouldCompact } from '../router.js';

interface PromptRequestBody {
  text: string;
  model?: { providerID: string; modelID: string };
  agent?: string;
  /** 添付ファイル (D&D / クリップボード貼付) — #2 §3.2 */
  attachments?: Array<{ mime: string; url: string; filename?: string }>;
}

/** @ファイル参照 (#2 §3.3): @path トークンを解決しファイル内容をコンテキストへ追加
 *  ※ Gatekeeper ポリシー(ワークスペース内)で検証してから読み込む (ファイルI/O 制御層を経由) */
const AT_RE = /(^|\s)@([\w./\\-]+)/g;
async function augmentFileRefs(text: string): Promise<string> {
  const matches = [...text.matchAll(AT_RE)];
  const paths = [...new Set(matches.map((m) => m[2]))];
  if (paths.length === 0) return text;
  const parts: string[] = [text];
  for (const p of paths) {
    // Gatekeeper のポリシー判定 (ワークスペース外はブロック) — 要件 #1 §3.4
    const policy = await fetch(`${env.gatekeeperUrl}/api/policy/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'read', path: p }),
    })
      .then((r) => r.json() as Promise<{ action?: string }>)
      .catch(() => ({ action: undefined }));
    if (policy.action === 'allow') {
      try {
        const res = await getOpencodeClient().file.read({ query: { path: p } });
        const content = (res.data as { content?: string } | undefined)?.content;
        if (content) parts.push(`\n\n【ファイル: ${p}】\n${content}`);
      } catch {
        /* ファイル解決不可は無視 */
      }
    }
  }
  return parts.join('');
}

export function registerMessageRoutes(app: Hono): void {
  const api = getOpencodeClient();

  app.get('/api/sessions/:id/messages', async (c) => {
    const id = c.req.param('id');
    const limit = Number(c.req.query('limit') ?? 0) || undefined;
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.messages({ path: { id }, query: { limit } }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  app.post('/api/sessions/:id/messages', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<PromptRequestBody>();
    if (!body.text) return c.json({ error: 'text is required' }, 400);

    // !Bash (#2 §3.3): サンドボックス(コンテナ)内でコマンドを実行し結果を返す
    // ※ @参照のファイル内容がコマンドへ混入しないよう、生テキストのまま判定し
    //   Markdown 画像記法 `![...]` とは衝突を回避
    if (body.text.trim().startsWith('!') && !body.text.trim().startsWith('![')) {
      const command = body.text.trim().slice(1).trim();
      const shell = await callOpencode(() =>
        api.session.shell({
          path: { id },
          body: { agent: body.agent ?? 'build', command },
        }),
      );
      if (shell.error) return c.json({ error: shell.error }, shell.unreachable ? 503 : 500);
      return c.json({ bash: { command, output: shell.data } }, 201);
    }

    // @ファイル参照: 内容をコンテキストへ自動追加 (#2 §3.3)
    const text = await augmentFileRefs(body.text);

    // プロンプト圧縮 (#18): 有効時は送信前に履歴を /compact 相当で圧縮
    if (await shouldCompact()) {
      await api.session.summarize({ path: { id } }).catch(() => {});
    }

    // LLM ルーター (#15): 未指定時はルールベースでモデルを選択し注入 (§2.3)
    const routed = body.model ? undefined : await resolveTaskModel(text);

    // ※ 推論量は OpenCode SDK の prompt body に直接注入できない (model は providerID/modelID のみ)。
    //   実効推論量を routed.reasoningEffort として返し、表示・記録に利用する (§3.2.1/§3.2.3)。
    // レスポンススキーマを常に一定に保つ (model 指定有無で形状を変えない)
    const parts: Array<
      | { type: 'text'; text: string }
      | { type: 'file'; mime: string; url: string; filename?: string }
    > = [{ type: 'text', text }];
    if (Array.isArray(body.attachments)) {
      for (const a of body.attachments) {
        if (a && typeof a.mime === 'string' && typeof a.url === 'string') {
          parts.push({ type: 'file', mime: a.mime, url: a.url, filename: a.filename });
        }
      }
    }
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.prompt({
        path: { id },
        body: {
          parts,
          model:
            body.model ??
            (routed ? { providerID: routed.providerID, modelID: routed.modelID } : undefined),
          agent: body.agent,
        },
      }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    // レスポンススキーマを常に一定に保つ (model 指定有無で形状を変えない)
    return c.json({ info: data, routed: routed ?? null }, 201);
  });

  // @ファイル参照のあいまい検索 (サジェスト用) — #2 §3.3
  app.get('/api/files', async (c) => {
    const q = c.req.query('q') ?? '';
    if (!q) return c.json([]);
    const { data, error, unreachable } = await callOpencode(() =>
      api.find.files({ query: { query: q, dirs: 'false' } }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    // SDK は string[] を返すが、防御的に検証して正規化
    if (!Array.isArray(data)) return c.json([]);
    return c.json(data.filter((p): p is string => typeof p === 'string'));
  });

  // OGP リンクプレビュー (#2 §4.2) — サーバサイドで og:* タグを取得 (CORS 回避)
  //  ※ SSRF 対策: プライベート/ループバック/予約レンジへのアクセスを禁止
  app.get('/api/ogp', async (c) => {
    const url = c.req.query('url') ?? '';
    if (!url || !(await isSafeOgpUrl(url))) return c.json({ error: 'url not allowed' }, 400);
    try {
      const res = await fetch(url, {
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; AME-Agent-Chat/1.0)' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return c.json({ error: 'fetch failed' }, 502);
      const html = await res.text();
      const og = (key: string) =>
        html.match(
          new RegExp(`<meta[^>]+property=["']og:${key}["'][^>]+content=["']([^"']+)["']`),
        )?.[1] ??
        html.match(
          new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${key}["']`),
        )?.[1];
      return c.json({
        url,
        title: og('title') ?? undefined,
        description: og('description') ?? undefined,
        image: og('image') ?? undefined,
      });
    } catch {
      return c.json({ error: 'fetch failed' }, 502);
    }
  });

  app.post('/api/sessions/:id/abort', async (c) => {
    const id = c.req.param('id');
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.abort({ path: { id } }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json({ ok: data });
  });

  app.post('/api/sessions/:id/command', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ command: string; arguments?: string }>();
    if (!body.command) return c.json({ error: 'command is required' }, 400);

    const { data, error, unreachable } = await callOpencode(() =>
      api.session.command({
        path: { id },
        body: { command: body.command, arguments: body.arguments ?? '' },
      }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  app.post('/api/sessions/:id/summarize', async (c) => {
    const id = c.req.param('id');
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.summarize({ path: { id } }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });

  app.post('/api/sessions/:id/init', async (c) => {
    const id = c.req.param('id');
    const { data, error, unreachable } = await callOpencode(() =>
      api.session.init({ path: { id } }),
    );
    if (error) return c.json({ error }, unreachable ? 503 : 500);
    return c.json(data);
  });
}

/** プライベート/ループバック/予約 IP 判定 (SSRF 対策) */
function isPrivateIp(ip: string): boolean {
  if (
    ip.startsWith('127.') ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('169.254.')
  ) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd')) return true; // loopback / fc00::/7
  if (ip.startsWith('fe80:')) return true; // link-local
  return false;
}

/** OGP 取得対象として安全な URL か (スキーマ + ホスト名/IP 検証) */
async function isSafeOgpUrl(raw: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false;
  try {
    const records = await lookup(host, { all: true });
    return records.length > 0 && records.every((r) => !isPrivateIp(r.address));
  } catch {
    return false;
  }
}
