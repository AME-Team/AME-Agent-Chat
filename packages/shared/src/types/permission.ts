/**
 * 権限リクエストのパス系種別 (要件 #2 §7)
 *
 * opencode の権限リクエスト (permission.updated) のうち、pattern をファイルパスとして
 * 扱う種別の一覧。bash 等の pattern はコマンド文字列 (配列の場合もある) のため
 * パストラバーサル判定の対象外とする。agent-core と gatekeeper 双方から参照する
 * 単一情報源 (追加時は両者へ同一の判定が反映される)。
 */
export const PATH_BASED_TYPES = new Set([
  'read',
  'edit',
  'write',
  'patch',
  'glob',
  'grep',
  'external_directory',
]);
