/**
 * @opencode-ai/sdk の event.subscribe({ signal }) が AbortSignal を受け付け、
 * abort で SSE 購読を終了できることを検証する (events.ts の購読解放の根拠)。
 * 実行: pnpm --filter @ame-agent-chat/agent-core test
 */
import assert from 'node:assert/strict';
import http from 'node:http';
import { test } from 'node:test';
import { createOpencodeClient } from '@opencode-ai/sdk';

/**
 * 最初の server.connected の 1 件だけを送出し、その後はデータを送らない SSE サーバ。
 * 定期 ping を送らないため、購読が abort されなければ it.next() はハングする
 * (偽陽性を排除: abort が無視された場合は 3 秒タイムアウトでテストが失敗する)。
 */
function startSseServer() {
  const sockets = new Set();
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    sockets.add(req.socket);
    res.write('event: server.connected\ndata: {}\n\n');
    const cleanup = () => {
      sockets.delete(req.socket);
    };
    req.socket.on('close', cleanup);
    res.on('close', cleanup);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        sockets,
        close() {
          for (const s of sockets) s.destroy();
          server.close();
        },
      });
    });
  });
}

test(
  'event.subscribe({ signal }) は abort でストリームを終了し接続を解放する',
  { timeout: 5000 },
  async () => {
    const mock = await startSseServer();
    try {
      const client = createOpencodeClient({ baseUrl: mock.url });
      const controller = new AbortController();
      const { stream } = await client.event.subscribe({ signal: controller.signal });
      const it = stream[Symbol.asyncIterator]();

      // 最初のイベント (server.connected) を受信して接続確立を確認 (ハング対策で race 付き)。
      // it.next() が reject してもタイマーを必ず破棄する
      let firstTimer;
      let first;
      try {
        first = await Promise.race([
          it.next(),
          new Promise((_, reject) => {
            firstTimer = setTimeout(() => reject(new Error('first event timeout')), 5000);
          }),
        ]);
      } finally {
        clearTimeout(firstTimer);
      }
      assert.equal(first.done, false);
      assert.ok(mock.sockets.size >= 1, 'SSE 接続が確立されていること');

      controller.abort();

      // abort 後はストリームが終了 (done:true) するか reject すること。
      // データを送らないサーバのため、abort が無視されれば it.next() はハングし
      // タイムアウトで失敗する (偽陽性にならない)。reject (AbortError) も正常系として許容する
      let timer;
      const result = await Promise.race([
        it
          .next()
          .then((r) => ({ kind: 'resolved', done: r.done }))
          .catch(() => ({ kind: 'rejected' })),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve({ kind: 'timeout' }), 3000);
        }),
      ]);
      clearTimeout(timer);
      assert.notEqual(result.kind, 'timeout', 'abort 後はストリームが終了すべき');
      if (result.kind === 'resolved') {
        assert.equal(result.done, true, 'abort 後に done:true で終了すべき');
      }

      // 接続解放の確認: abort 後は socket が閉じられる (遅い CI でもフレークしないよう余裕を持つ)
      const deadline = Date.now() + 5000;
      while (mock.sockets.size > 0 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.equal(mock.sockets.size, 0, 'abort 後は SSE 接続が解放されること');
    } finally {
      mock.close();
    }
  },
);
