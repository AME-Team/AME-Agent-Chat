/**
 * CORS / Origin 検証の共通設定 (Issue #73)
 *
 * `CORS_ORIGIN` はカンマ区切りで複数オリジンを指定できる。正規化規則
 * (split + trim + filter) を server.ts の Hono cors ミドルウェアと
 * terminal.ts の isOriginAllowed で共有する。logs.ts (/api/logs/download) は
 * terminal.ts の isOriginAllowed を import して再利用するため、同一判定になる。
 *
 * フェイルクローズ設計: `*` と明示エントリの混在は「不正な設定」とみなす。
 * - CORS 層: 混在時は `*` を無視し、明示エントリのみ許可 (全オリジンへは開かない)
 * - Origin 検証層 (terminal/logs): 混在時も明示エントリで判定 (非対称な 403 を防ぐ)
 * これにより「CORS は通るのに実行は 403」になる運用上の罠を避ける。
 *
 * env (CORS_ORIGIN) はプロセス起動後に不変のため、正規化と警告はモジュール読込時に
 * 一度だけ行い、以降のリクエストでは結果を再利用する (毎リクエストの再計算・警告頻発を回避)。
 */
import { env } from './env.js';
import { log } from './logger.js';

/** CORS_ORIGIN を「スキーム + ホスト + ポート」完全一致で比較するリストへ正規化する。
 *  末尾スラッシュや明示ポート表記は一致しない (ブラウザの Origin と同一表記を設定すること) */
function parseAllowedOrigins(): string[] {
  return env.corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

const origins = parseAllowedOrigins();

/** `*` を含む要素 (単独 `*` を除く) を検出したら警告する。
 *  サブドメインワイルドカード (`https://*.example.com`) は非対応のため黙殺される */
function warnSubdomainWildcards(): void {
  const subdomain = origins.find((o) => o.includes('*') && o !== '*');
  if (subdomain) {
    log.warn(
      `CORS_ORIGIN にサブドメインワイルドカードが含まれています。サポート対象外のため一致しません: ${subdomain}`,
    );
  }
}

/** `*` と明示エントリの混在を警告する (フェイルクローズで明示エントリのみ有効になる) */
function warnMixedWildcard(): void {
  if (origins.includes('*') && origins.some((o) => o !== '*')) {
    log.warn(
      `CORS_ORIGIN に '*' と明示エントリが混在しています。明示エントリのみ有効になり '*' は無視されます (${env.corsOrigin})`,
    );
  }
}

/** 起動時に一度だけ設定を検証し警告する */
warnSubdomainWildcards();
warnMixedWildcard();

/** 有効な明示オリジン一覧。`*` は単独指定の場合のみ全オリジン許可の意味を持ち、
 *  混在時は無効化される (モジュール読込時に一度だけ計算する) */
export const effectiveAllowedOrigins: readonly string[] = origins.filter((o) => o !== '*');

/** 単独の `*` のみで全オリジン許可を意図しているか */
const wildcardAll = origins.length === 1 && origins[0] === '*';

/** Hono cors の origin 値へ変換する。
 *  - 単独 `*` のみ → 全オリジン許可 (従来の CORS_ORIGIN=* 挙動を維持)
 *  - それ以外 → 明示エントリの完全一致リスト (混在時は `*` を無視するフェイルクローズ) */
export function corsOriginOption():
  string | string[] | ((origin: string) => string | undefined | null) {
  if (wildcardAll) return (origin: string) => origin;
  return [...effectiveAllowedOrigins];
}
