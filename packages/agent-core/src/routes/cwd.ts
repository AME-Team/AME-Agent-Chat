/**
 * カレントディレクトリ API (Issue #56)
 *
 *  - GET  /api/cwd  現在のディレクトリ + 選択可能なプロジェクト一覧
 *  - POST /api/cwd  ディレクトリを選択 (Gatekeeper へ永続化)
 */
import type { Hono } from 'hono';
import {
  applyCurrentDirectory,
  isDirectoryReady,
  listProjects,
  resolveCurrentDirectory,
  settingsOk,
} from '../cwd.js';

export function registerCwdRoutes(app: Hono): void {
  app.get('/api/cwd', async (c) => {
    const [current, projects] = await Promise.all([resolveCurrentDirectory(), listProjects()]);
    return c.json({ current, projects, ready: isDirectoryReady(), settingsOk: settingsOk() });
  });

  app.post('/api/cwd', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const directory = typeof body.directory === 'string' ? body.directory.trim() : '';
    if (!directory) return c.json({ error: 'directory is required' }, 400);
    try {
      await applyCurrentDirectory(directory);
    } catch (err) {
      // 他ルートと同様に { error } JSON で失敗を伝播する
      return c.json({ error: 'gatekeeper persist failed', message: String(err) }, 500);
    }
    return c.json({ current: directory });
  });
}
