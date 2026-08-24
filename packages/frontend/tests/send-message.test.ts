/**
 * store.sendMessage / createSession の回帰テスト
 * - sendMessage: 失敗パス (楽観的メッセージ除去・busy 復帰)
 * - createSession: 新規チャット連打による空セクション増殖の防護 (Issue #71)
 * 実行: pnpm --filter @ame-agent-chat/frontend test
 *
 * ※ 実行基盤の注記: store は TS + ブラウザ前提モジュールのため tsx (TS ローダー) で実行する。
 *   agent-core のテストは素の node:test + .mjs (SDK を直接検証するため変換不要) で行っており、
 *   変換が不要かどうかで使い分けている。
 */
import './polyfill-localStorage';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, mock, test } from 'node:test';
import { api, ApiError } from '../src/lib/api';
import { useApp, resetAppModuleTestState } from '../src/store/app';

// store はモジュールシングルトンのため、テスト間で状態をリセットする
beforeEach(() => {
  useApp.setState({
    currentId: null,
    messages: [],
    busy: false,
    sessions: [],
    touchedSessionIds: new Set(),
    messagesLoadingId: null,
    inFlightCreatePromise: null,
    currentDirectory: '',
    cwdSwitchCount: 0,
  });
  // モジュールレベルのテスト参照状態もリセットする (#71)
  resetAppModuleTestState();
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

// ---------------------------------------------------------------------------
// createSession: 新規チャット連打による空セクション増殖の防護 (Issue #71)
// ---------------------------------------------------------------------------

function session(id: string, title = id) {
  return { id, title, time: { created: 0, updated: 0 } };
}

function mockCreate(id = 'ses_new') {
  return mock.method(api.sessions, 'create', async () => session(id));
}

test('createSession: 未送信の空セクション (無題) を流用し API を呼ばない (Issue #71)', async () => {
  const create = mockCreate();
  useApp.setState({
    currentId: 'ses_empty',
    messages: [],
    sessions: [session('ses_empty', '')],
  });

  assert.equal(await useApp.getState().createSession(), 'ses_empty');
  assert.equal(await useApp.getState().createSession(), 'ses_empty', '連打しても増殖しない');
  assert.equal(create.mock.callCount(), 0, 'create が呼ばれないこと');
  assert.equal(useApp.getState().sessions.length, 1);
});

test('createSession: リネーム済みの空セッションは流用せず新規作成する (Issue #71)', async () => {
  const create = mockCreate();
  useApp.setState({
    currentId: 'ses_named',
    messages: [],
    sessions: [session('ses_named', 'My Project')],
  });

  assert.equal(await useApp.getState().createSession(), 'ses_new');
  assert.equal(create.mock.callCount(), 1, '名前付きセッションは流用しないこと');
});

test('createSession: 送信済みセクションでは新規作成する (Issue #71)', async () => {
  const create = mockCreate();
  useApp.setState({
    currentId: 'ses_used',
    messages: [{ id: 'm1', role: 'user', text: 'hello' }],
    sessions: [session('ses_used')],
  });

  assert.equal(await useApp.getState().createSession(), 'ses_new');
  assert.equal(create.mock.callCount(), 1);
});

test('createSession: history を持つセクション選択後は新規作成できる (Issue #71)', async () => {
  const create = mockCreate();
  // loadMessages が履歴を返す → touched に登録される
  mock.method(api.messages, 'list', async () => [
    { info: { id: 'm-h1', role: 'user' }, parts: [{ type: 'text', text: 'before' }] },
  ]);
  useApp.setState({ currentId: null, messages: [], sessions: [session('ses_hist')] });

  await useApp.getState().selectSession('ses_hist');
  assert.equal(await useApp.getState().createSession(), 'ses_new');
  assert.equal(create.mock.callCount(), 1);
});

test('createSession: 一覧に存在しない currentId は流用せず新規作成する (Issue #71)', async () => {
  const create = mockCreate();
  useApp.setState({ currentId: 'ses_deleted', messages: [], sessions: [] });

  assert.equal(await useApp.getState().createSession(), 'ses_new');
  assert.equal(create.mock.callCount(), 1);
});

test('createSession: 並行呼び出しは同一結果を返し二重作成しない (Issue #71)', async () => {
  let resolveCreate:
    | ((s: { id: string; title: string; time: { created: number; updated: number } }) => void)
    | undefined;
  mock.method(
    api.sessions,
    'create',
    () =>
      new Promise<{ id: string; title: string; time: { created: number; updated: number } }>(
        (res) => (resolveCreate = res),
      ),
  );
  useApp.setState({
    currentId: 'ses_used',
    messages: [{ id: 'm1', role: 'user', text: 'hello' }],
    sessions: [session('ses_used')],
  });

  const p1 = useApp.getState().createSession();
  const p2 = useApp.getState().createSession();
  resolveCreate?.(session('ses_one'));

  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1, 'ses_one');
  assert.equal(r2, 'ses_one');
});

test('createSession: 空セクション送信後は新規作成できる (流れ検証 #71)', async () => {
  mockSessionApi();
  const create = mockCreate();
  mock.method(api.messages, 'send', async () => undefined);
  useApp.setState({
    currentId: 'ses_fresh',
    messages: [],
    sessions: [session('ses_fresh', '')],
  });

  // 未送信の連打 → 流用
  assert.equal(await useApp.getState().createSession(), 'ses_fresh');
  assert.equal(create.mock.callCount(), 0);

  // 送信 → 送信済みとして扱われる
  await useApp.getState().sendMessage('hello');
  assert.equal(useApp.getState().messages.length, 1);

  // 送信済みなら新規作成できる (連打の増殖はしない)
  assert.equal(await useApp.getState().createSession(), 'ses_new');
  assert.equal(create.mock.callCount(), 1);
});

test('createSession: clearMessages 後も送信済みセッションは未送信と誤判定しない (Issue #71)', async () => {
  mockSessionApi();
  const create = mockCreate();
  mock.method(api.messages, 'send', async () => undefined);
  // 無題 + 未送信のままでは流用対象になるセッションを作り、送信により touched で
  // 「送信済み」と判定されることを検証する (touched 機構の単独検証 #71)
  useApp.setState({
    currentId: 'ses_used',
    messages: [],
    sessions: [session('ses_used', '')],
  });

  await useApp.getState().sendMessage('hello');
  useApp.getState().clearMessages();
  assert.equal(useApp.getState().messages.length, 0);

  assert.equal(await useApp.getState().createSession(), 'ses_new', '送信済みなら新規作成すること');
  assert.equal(create.mock.callCount(), 1, '送信済みなら create が呼ばれること');
});

test('createSession: 履歴読込中のセッションは流用しない (Issue #71)', async () => {
  let resolveList: ((e: unknown[]) => void) | undefined;
  mock.method(api.messages, 'list', () => new Promise((res) => (resolveList = res)));
  const create = mockCreate();
  useApp.setState({ currentId: null, messages: [], sessions: [session('ses_loading', '')] });

  // 読込未完了のまま連打 → 未判定のため流用せず新規作成する
  const selectP = useApp.getState().selectSession('ses_loading');
  assert.equal(await useApp.getState().createSession(), 'ses_new');
  assert.equal(create.mock.callCount(), 1);

  resolveList?.([]);
  await selectP;
});

test('createSession: 作成の await 中にディレクトリ切替が起きたら孤児を削除し null を返す (Issue #71)', async () => {
  let resolveCreate:
    | ((s: { id: string; title: string; time: { created: number; updated: number } }) => void)
    | undefined;
  mock.method(
    api.sessions,
    'create',
    () =>
      new Promise<{ id: string; title: string; time: { created: number; updated: number } }>(
        (res) => (resolveCreate = res),
      ),
  );
  const remove = mock.method(api.sessions, 'remove', async () => ({ ok: true }));
  useApp.setState({
    currentId: 'ses_used',
    messages: [{ id: 'm1', role: 'user', text: 'hello' }],
    sessions: [session('ses_used')],
    currentDirectory: '/dirA',
    cwdSwitchCount: 0,
  });

  const p = useApp.getState().createSession();
  // 作成の await 中にユーザーによるディレクトリ切替 (cwdSwitchCount が増える)
  useApp.setState({
    cwdSwitchCount: 1,
    currentDirectory: '/dirB',
    currentId: null,
    sessions: [],
    messages: [],
    touchedSessionIds: new Set(),
    inFlightCreatePromise: null,
  });
  resolveCreate?.(session('ses_orphan'));

  const id = await p;
  assert.equal(id, null, '一覧外の孤児 ID を返さないこと');
  assert.equal(remove.mock.callCount(), 1, '孤児セッションが削除されること');
  assert.equal(remove.mock.calls[0].arguments[0], 'ses_orphan');
});

test('createSession: 履歴読込失敗時は fail-open で新規作成する (Issue #71)', async () => {
  mock.method(api.messages, 'list', async () => {
    throw new ApiError('/api/sessions/ses_tmp/messages', 500, { error: 'boom' });
  });
  const create = mockCreate();
  useApp.setState({ currentId: null, messages: [], sessions: [session('ses_tmp', '')] });

  await useApp.getState().selectSession('ses_tmp');
  const id = await useApp.getState().createSession();
  assert.equal(id, 'ses_new', '読込失敗時は流用せず新規作成すること');
  assert.equal(create.mock.callCount(), 1, 'fail-open として create が呼ばれること');
});

test('createSession: 読込失敗→空確定で防護が復元される (Issue #71)', async () => {
  let fail = true;
  mock.method(api.messages, 'list', async () => {
    if (fail) throw new ApiError('/api/sessions/ses_tmp/messages', 500, { error: 'boom' });
    return [];
  });
  const create = mockCreate();
  useApp.setState({ currentId: null, messages: [], sessions: [session('ses_tmp', '')] });

  // 読込失敗 → fail-open で送信済み扱い
  await useApp.getState().selectSession('ses_tmp');

  // 空と再確定 → 防護が復元され流用される
  fail = false;
  await useApp.getState().selectSession('ses_tmp');
  assert.equal(await useApp.getState().createSession(), 'ses_tmp');
  assert.equal(create.mock.callCount(), 0, '防護が復元され create が呼ばれないこと');
});

test('setCurrentDirectory: 同一ディレクトリ再選択もカウンタを増やす (孤児判定の前提 #71)', async () => {
  mock.method(api.cwd, 'set', async () => ({ current: '/dirA' }));
  mock.method(api.sessions, 'list', async () => []);
  useApp.setState({ currentDirectory: '/dirA', cwdSwitchCount: 0 });

  await useApp.getState().setCurrentDirectory('/dirA');

  assert.equal(
    useApp.getState().cwdSwitchCount,
    1,
    '同一ディレクトリ再選択も切替としてカウントする',
  );
});

test('setCurrentDirectory: ユーザー切替のみ cwdSwitchCount を増やす (孤児判定の前提 #71)', async () => {
  mock.method(api.cwd, 'set', async () => ({ current: '/dirB' }));
  mock.method(api.sessions, 'list', async () => []);
  useApp.setState({ currentDirectory: '/dirA', cwdSwitchCount: 0 });

  await useApp.getState().setCurrentDirectory('/dirB');

  assert.equal(useApp.getState().cwdSwitchCount, 1, 'ユーザー切替でカウンタが増えること');
});

test('loadCurrentDirectory: 起動時復元は cwdSwitchCount を増やさない (孤児判定の前提 #71)', async () => {
  mock.method(api.cwd, 'get', async () => ({
    current: '/x',
    projects: [],
    ready: true,
    settingsOk: true,
  }));
  useApp.setState({ cwdSwitchCount: 0 });

  await useApp.getState().loadCurrentDirectory();

  assert.equal(useApp.getState().cwdSwitchCount, 0, '復元ではカウンタが増えないこと');
});

test('createSession: カウンタ不変のまま値だけ変わっても孤児判定しない (カウンタゲートの分離検証 #71)', async () => {
  let resolveCreate:
    | ((s: { id: string; title: string; time: { created: number; updated: number } }) => void)
    | undefined;
  mock.method(
    api.sessions,
    'create',
    () =>
      new Promise<{ id: string; title: string; time: { created: number; updated: number } }>(
        (res) => (resolveCreate = res),
      ),
  );
  const remove = mock.method(api.sessions, 'remove', async () => ({ ok: true }));
  useApp.setState({
    currentId: 'ses_used',
    messages: [{ id: 'm1', role: 'user', text: 'hello' }],
    sessions: [session('ses_used')],
    currentDirectory: '/dirA',
    cwdSwitchCount: 0,
  });

  const p = useApp.getState().createSession();
  // cwdSwitchCount 不変のまま currentDirectory だけ別値 '/dirX' へ遷移 (ユーザー切替なし)
  useApp.setState({ currentDirectory: '/dirX' });
  resolveCreate?.(session('ses_new'));

  const id = await p;
  assert.equal(id, 'ses_new', 'カウンタ不変なら値が変わっても孤児扱いしない (null を返さない)');
  assert.equal(remove.mock.callCount(), 0, '孤児セッション削除が実行されないこと');
});

test('createSession: 切替→元のディレクトリへ復帰した場合は孤児判定しない (Issue #71)', async () => {
  let resolveCreate:
    | ((s: { id: string; title: string; time: { created: number; updated: number } }) => void)
    | undefined;
  mock.method(
    api.sessions,
    'create',
    () =>
      new Promise<{ id: string; title: string; time: { created: number; updated: number } }>(
        (res) => (resolveCreate = res),
      ),
  );
  const remove = mock.method(api.sessions, 'remove', async () => ({ ok: true }));
  useApp.setState({
    currentId: 'ses_used',
    messages: [{ id: 'm1', role: 'user', text: 'hello' }],
    sessions: [session('ses_used')],
    currentDirectory: '/dirA',
    cwdSwitchCount: 0,
  });

  const p = useApp.getState().createSession();
  // await 中に /dirA → /dirB → /dirA と切替→復帰 (カウンタは増えるが値は同じ)
  useApp.setState({ currentDirectory: '/dirB', cwdSwitchCount: 1 });
  useApp.setState({ currentDirectory: '/dirA' });
  resolveCreate?.(session('ses_new'));

  const id = await p;
  assert.equal(id, 'ses_new', '切替→復帰では孤児扱いしない (null を返さない)');
  assert.equal(remove.mock.callCount(), 0, '正常な作成を孤児として削除しないこと');
});

test('createSession: 切替なし (cwdSwitchCount 不変) の復元/リロードでは孤児判定しない (Issue #71)', async () => {
  let resolveCreate:
    | ((s: { id: string; title: string; time: { created: number; updated: number } }) => void)
    | undefined;
  mock.method(
    api.sessions,
    'create',
    () =>
      new Promise<{ id: string; title: string; time: { created: number; updated: number } }>(
        (res) => (resolveCreate = res),
      ),
  );
  const remove = mock.method(api.sessions, 'remove', async () => ({ ok: true }));
  useApp.setState({
    currentId: 'ses_used',
    messages: [{ id: 'm1', role: 'user', text: 'hello' }],
    sessions: [session('ses_used')],
    currentDirectory: '/dirA',
    cwdSwitchCount: 0,
  });

  const p = useApp.getState().createSession();
  // await 中に復元 ('' → 実値) やリロード (実値 → '') が起きても cwdSwitchCount は不変
  useApp.setState({ currentDirectory: '' });
  useApp.setState({ currentDirectory: '/dirA' });
  resolveCreate?.(session('ses_new'));

  const id = await p;
  assert.equal(id, 'ses_new', '復元/リロードでは孤児扱いしない (null を返さない)');
  assert.equal(remove.mock.callCount(), 0, '孤児セッション削除が実行されないこと');
});

test('createSession: 孤児パス (切替中) は選択有無に関わらず null を返す (Issue #71)', async () => {
  let resolveCreate:
    | ((s: { id: string; title: string; time: { created: number; updated: number } }) => void)
    | undefined;
  mock.method(
    api.sessions,
    'create',
    () =>
      new Promise<{ id: string; title: string; time: { created: number; updated: number } }>(
        (res) => (resolveCreate = res),
      ),
  );
  const remove = mock.method(api.sessions, 'remove', async () => ({ ok: true }));
  useApp.setState({
    currentId: 'ses_used',
    messages: [{ id: 'm1', role: 'user', text: 'hello' }],
    sessions: [session('ses_used')],
    currentDirectory: '/dirA',
    cwdSwitchCount: 0,
  });

  const p = useApp.getState().createSession();
  // 切替後、新ディレクトリで別セッションを選択済み (cwdSwitchCount が増える)
  useApp.setState({
    cwdSwitchCount: 1,
    currentDirectory: '/dirB',
    currentId: 'ses_newsel',
    sessions: [session('ses_newsel')],
    messages: [],
    touchedSessionIds: new Set(),
    inFlightCreatePromise: null,
  });
  resolveCreate?.(session('ses_orphan'));

  const id = await p;
  assert.equal(id, null, '切替中は null を返す (新規作成なしの契約 #71)');
  assert.equal(remove.mock.callCount(), 1, '孤児セッションが削除されること');
});

test('createSession: 空タイトルセッション流用後の初回送信でタイトル自動生成が発火する (Issue #71)', async () => {
  const update = mock.method(api.sessions, 'update', async (id) => session(id, 'hello'));
  mock.method(api.messages, 'send', async () => undefined);
  mock.method(api.messages, 'list', async () => []);
  const create = mockCreate();
  useApp.setState({
    currentId: 'ses_untitled',
    messages: [],
    sessions: [session('ses_untitled', '')],
  });

  // 未タイトルの空セッションを流用
  assert.equal(await useApp.getState().createSession(), 'ses_untitled');
  assert.equal(create.mock.callCount(), 0);

  await useApp.getState().sendMessage('hello');
  assert.equal(update.mock.callCount(), 1, '初回送信でタイトル自動生成が発火すること');
});

test('sendMessage: currentId が無い場合も作成後に送信まで到達する (Issue #71)', async () => {
  mockSessionApi();
  const send = mock.method(api.messages, 'send', async () => undefined);
  useApp.setState({ currentId: null, messages: [], sessions: [] });

  await useApp.getState().sendMessage('hello');

  assert.equal(send.mock.callCount(), 1, 'created したセッションへ送信が実行されること');
  assert.equal(useApp.getState().messages.length, 1, '楽観的メッセージが残ること');
});
