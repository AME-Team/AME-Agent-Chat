/**
 * 権限リクエストのパス系種別 (要件 #2 §7)
 *
 * opencode の権限リクエスト (permission.updated) のうち、pattern をファイルパスとして
 * 扱う種別の一覧。bash 等の pattern はコマンド文字列 (配列の場合もある) のため
 * パストラバーサル判定の対象外とする。
 *
 * 種別は opencode 公式ドキュメント "Available Permissions" に基づくツール名ベース:
 *   - read / glob / grep: pattern をパス/グロブとして扱う
 *   - edit: 全ファイル変更 (edit / write / patch を包含)
 *   - external_directory: ワークスペース外パスを触るツール共通のセーフガード
 * write / patch は opencode では edit に包含されるが、カスタムツール等が個別に
 * 発行する場合に備えて防御的に残す。ルール外のパス系種別は fail-closed で承認に回る。
 *
 * agent-core と gatekeeper 双方から参照する単一情報源。ReadonlySet で不変契約を
 * 明示し、誤った変更が他パッケージの判定へ波及しないようにする。
 */
export const PATH_BASED_TYPES: ReadonlySet<string> = new Set([
  'read',
  'edit',
  'write',
  'patch',
  'glob',
  'grep',
  'external_directory',
]);
