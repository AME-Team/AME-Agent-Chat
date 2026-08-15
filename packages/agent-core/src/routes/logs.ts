/**
 * ログ出力 API (Issue #73)
 *
 * Agent Core のログファイル (logger.ts が追記) をフロントエンドへ提供する。
 * 設定画面からダウンロードする用途を想定し、最新世代と .1 世代 (.log.1) を連結する。
 *
 * セキュリティ: ログにはリクエスト詳細や SDK 呼び出し内容が含まれ得るため、
 * - ターミナル API と同じ共有トークン (x-terminal-token) + Origin 検証を要求する
 * - `LOG_API_ENABLED=false` (既定 true) でこの API 自体を無効化できる
 */
import { closeSync, existsSync, openSync, readSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import type { Hono } from 'hono';
import { LOG_DOWNLOAD_ERROR_CODES } from '@ame-agent-chat/shared';
import { env } from '../env.js';
import { log } from '../logger.js';
import { isOriginAllowed, isTerminalTokenValid, TERMINAL_TOKEN_HEADER } from './terminal.js';

/** ダウンロード時に読み込むログの上限 (bytes)。ローテーション失敗で肥大化しても
 *  プロセスへ過大なメモリを載せないよう末尾側を上限分だけ返す (Issue #73) */
const LOG_READ_LIMIT = 10 * 1024 * 1024;

/** ファイル末尾から最大 limit bytes を読み込む (存在しない世代はスキップ)。
 *  切詰め時は行境界へ整列し、半行・文字化け (マルチバイト途中) を避ける。
 *  stat → open 間にローテーション (rename) や追記が走っても NUL 混入しないよう、
 *  readSync の bytesRead でバッファを切り詰め、サイズ不整合時は truncated を立てる */
function readTail(file: string, limit: number): { content: string; truncated: boolean } {
  try {
    const fd = openSync(file, 'r');
    try {
      const size = statSync(file).size;
      if (size === 0) return { content: '', truncated: false };
      const start = Math.max(0, size - limit);
      const buf = Buffer.alloc(size - start);
      const bytesRead = readSync(fd, buf, 0, buf.length, start);
      const read = buf.subarray(0, bytesRead);
      const content = read.toString('utf8');
      // 末尾が期待サイズに満たない場合はローテーション競合等で切り詰まった可能性が高い
      const truncated = start > 0 || bytesRead < buf.length;
      // 切詰め時 (先頭が行途中) は最初の行全体を破棄し、次の改行へ整列する。
      // 改行が存在しない巨大レコード (単一行 JSON / スタックダンプ等) は、
      // 空にするより部分行でも末尾を返す方が原因調査に資する
      if (start > 0) {
        const firstNewline = content.indexOf('\n');
        if (firstNewline === -1) return { content, truncated };
        return { content: content.slice(firstNewline + 1), truncated };
      }
      return { content, truncated };
    } finally {
      closeSync(fd);
    }
  } catch (err) {
    // 読み取り失敗 (EACCES 等) は空返却で欠落を隠さず、呼び出し元で 500 として通知する。
    // ただし ENOENT (existsSync 確認後・open 前のローテーション競合で消えた場合) は
    // 「存在しない世代」として空扱いにする (稀な競合で 500 にしない)
    if ((err as { code?: string }).code === 'ENOENT') {
      return { content: '', truncated: false };
    }
    throw new Error(
      `failed to read log file ${file}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * ローテーション済み (.log.1) を含む連結内容。各世代を「古い→新しい」順に並べ、
 * 全体が上限を超える場合は最新側 (現行ファイル) を優先して末尾を返す。
 * 読み取り失敗 (権限等) は throw し、呼び出し元で 500 として通知する (欠落を隠さない)。
 */
function readLogs(): { content: string; truncated: boolean } {
  let total = 0;
  const files = [`${env.logFile}.1`, env.logFile];
  // 上限を超える場合は新しい世代から読み込み、古い世代を切り捨てる
  let truncated = false;
  const parts: string[] = [];
  for (let i = files.length - 1; i >= 0; i--) {
    if (total >= LOG_READ_LIMIT) {
      truncated = true;
      continue;
    }
    // 存在しない世代 (.log.1 初回等) はスキップする。readTail は読み取り失敗のみ throw
    if (!existsSync(files[i])) continue;
    const budget = LOG_READ_LIMIT - total;
    const { content, truncated: tailTruncated } = readTail(files[i], budget);
    if (tailTruncated) truncated = true;
    parts.unshift(content);
    // 集計はバイト単位で行う (マルチバイト主体のログでも 10MB 上限を厳守する)
    total += Buffer.byteLength(content);
  }
  return { content: parts.join(''), truncated };
}

export function registerLogRoutes(app: Hono): void {
  app.get('/api/logs/download', (c) => {
    if (!env.logApiEnabled) {
      return c.json({ error: 'log API disabled', code: LOG_DOWNLOAD_ERROR_CODES.DISABLED }, 403);
    }
    // 機微情報を含むため、ターミナル API と同じ共有トークン + Origin 検証を要求する。
    // フロントは /api/terminal/token で取得した共有トークンをヘッダで提示する。
    // ブラウザの同一オリジン GET は Origin ヘッダを送らないため、Origin が無い場合は
    // トークン検証のみで許可する (トークンは Origin 検証付きの /api/terminal/token 経由で
    // しか取得できないため、トークン保持自体が正規フロントの証明になる)
    const origin = c.req.header('origin');
    if (origin && !isOriginAllowed(origin)) {
      return c.json(
        { error: 'origin not allowed', code: LOG_DOWNLOAD_ERROR_CODES.ORIGIN_NOT_ALLOWED },
        403,
      );
    }
    if (!isTerminalTokenValid(c.req.header(TERMINAL_TOKEN_HEADER))) {
      return c.json({ error: 'invalid token', code: LOG_DOWNLOAD_ERROR_CODES.INVALID_TOKEN }, 403);
    }
    // ログ未作成 (両世代とも存在しない) のみ 404 とし、空ファイルは 200 + 空本文を返す
    if (!existsSync(env.logFile) && !existsSync(`${env.logFile}.1`)) {
      return c.json({ error: 'log not found', code: LOG_DOWNLOAD_ERROR_CODES.NOT_FOUND }, 404);
    }
    let content: string;
    let truncated: boolean;
    try {
      ({ content, truncated } = readLogs());
    } catch (err) {
      // 読み取り失敗 (権限等) は 200 + 空本文で欠落を隠さず 500 を返す
      log.error('log download read failed', err instanceof Error ? err.message : String(err));
      return c.json({ error: 'log read failed' }, 500);
    }
    c.header('Content-Type', 'text/plain; charset=utf-8');
    // 末尾切り捨てを明示 (肥大時もプロセスへ過大なメモリを載せない)
    if (truncated) c.header('X-Log-Truncated', 'true');
    // Content-Disposition のインジェクション (CR/LF・二重引用符) を防ぐため固定名にフォールバック
    const rawName = basename(env.logFile);
    const safeName = /^[A-Za-z0-9._-]+$/.test(rawName) ? rawName : 'agent-core.log';
    c.header('Content-Disposition', `attachment; filename="${safeName}"`);
    return c.body(content);
  });
}
