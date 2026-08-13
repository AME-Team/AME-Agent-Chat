/**
 * store.sendMessage の失敗パス回帰テスト (send 失敗時に楽観的メッセージが除去され
 * busy が復帰することを検証)。実行: pnpm --filter @ame-agent-chat/frontend test
 *
 * ※ 実行基盤の注記: store は TS + ブラウザ前提モジュールのため tsx (TS ローダー) で実行する。
 *   agent-core のテストは素の node:test + .mjs (SDK を直接検証するため変換不要) で行っており、
 *   変換が不要かどうかで使い分けている。
 */
import './polyfill-localStorage';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { api, ApiError } from '../src/lib/api';
import { useApp } from '../src/store/app';

// store はモジュールシングルトンのため、テスト間で状態をリセットする
beforeEach(() => {
  useApp.setState({ currentId: null, messages: [], busy: false, sessions: [] });
});

// module レベルの mock.method は自動復元されないため、テスト終了時に明示的に復元する
afterEach(() => {
  mock.restoreAll();
});

function mockSessionApi() {
  mock.method(api.sessions, 'create', async () => ({
    id: 'ses_test',
    title: 'test',
    time: { created: Date.now(), updated: Date.now() },
  }));
  // タイトル自動生成 (fire-and-forget) が未処理 reject を出さないよう mock
  mock.method(api.sessions, 'update', async () => ({
    id: 'ses_test',
    title: 'test',
    time: { created: Date.now(), updated: Date.now() },
  }));
  // 失敗パスの再同期 (loadMessages) が Node の相対 URL fetch に依存しないよう mock
  return mock.method(api.messages, 'list', async () => []);
}

test('sendMessage: 曖昧な送信失敗時は再同期し楽観的メッセージを除去して busy が復帰する', async () => {
  const list = mockSessionApi();
  mock.method(api.messages, 'send', async () => {
    throw new Error('boom');
  });

  assert.equal(useApp.getState().currentId, null);
  await useApp.getState().sendMessage('hello');

  assert.equal(list.mock.callCount(), 1, '曖昧な失敗 (非 4xx) では再同期が実行されること');
  assert.equal(useApp.getState().messages.length, 0, '楽観的メッセージが除去されること');
  assert.equal(useApp.getState().busy, false, 'busy が復帰すること');
});

test('sendMessage: 決定的な失敗 (4xx) では再同期せず楽観的メッセージを除去する', async () => {
  const list = mockSessionApi();
  mock.method(api.messages, 'send', async () => {
    throw new ApiError('/api/sessions/ses_test/messages', 400, { error: 'bad request' });
  });

  await useApp.getState().sendMessage('hello');

  assert.equal(list.mock.callCount(), 0, '4xx では再同期が実行されないこと');
  assert.equal(useApp.getState().messages.length, 0, '楽観的メッセージが除去されること');
  assert.equal(useApp.getState().busy, false, 'busy が復帰すること');
});

test('sendMessage: 過渡的失敗 (408/429) は再同期する', async () => {
  for (const status of [408, 429]) {
    const list = mockSessionApi();
    mock.method(api.messages, 'send', async () => {
      throw new ApiError('/api/sessions/ses_test/messages', status, { error: 'retry' });
    });

    await useApp.getState().sendMessage('hello');

    assert.equal(list.mock.callCount(), 1, `${status} では再同期が実行されること`);
    assert.equal(useApp.getState().messages.length, 0, '楽観的メッセージが除去されること');
    assert.equal(useApp.getState().busy, false, 'busy が復帰すること');
    mock.restoreAll();
    useApp.setState({ currentId: null, messages: [], busy: false, sessions: [] });
  }
});

test('sendMessage: セッション作成失敗時は送信を中断し状態を壊さない', async () => {
  mock.method(api.sessions, 'create', async () => {
    throw new Error('create failed');
  });
  // create 失敗時は createSession がエラートーストを表示し throw するため、send は呼ばれない
  const send = mock.method(api.messages, 'send', async () => undefined);

  await useApp.getState().sendMessage('hello');

  assert.equal(send.mock.callCount(), 0, 'send が呼ばれないこと');
  assert.equal(useApp.getState().messages.length, 0, '楽観的メッセージが残らないこと');
  assert.equal(useApp.getState().busy, false, 'busy が変わらないこと');
});
