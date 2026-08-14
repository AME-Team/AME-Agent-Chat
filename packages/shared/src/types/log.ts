/**
 * ログダウンロード API のエラーコード (Issue #73)
 *
 * Agent Core の /api/logs/download とフロントエンド (設定画面) の間で使う
 * 機械可読なエラーコード。エラー本文 (error) は表示用の自由な文言のため、
 * フロントはこの code で原因を判定する。変更時は両パッケージに反映される。
 */
export const LOG_DOWNLOAD_ERROR_CODES = {
  DISABLED: 'log_api_disabled',
  ORIGIN_NOT_ALLOWED: 'origin_not_allowed',
  INVALID_TOKEN: 'invalid_token',
  NOT_FOUND: 'log_not_found',
} as const;

export type LogDownloadErrorCode =
  (typeof LOG_DOWNLOAD_ERROR_CODES)[keyof typeof LOG_DOWNLOAD_ERROR_CODES];
