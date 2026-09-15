import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeWithPopup } from '../docs/js/auth-flow.js';

function clock() {
  const callbacks = new Map();
  const add = (fn, type) => { callbacks.set(type, fn); return type; };
  return {
    options: { interval: fn => add(fn, 'poll'), timeout: fn => add(fn, 'timeout'), clearInterval: key => callbacks.delete(key), clearTimeout: key => callbacks.delete(key) },
    run: type => callbacks.get(type)?.(),
    get size() { return callbacks.size; },
  };
}

test('blocked popup rejects immediately so the connection button can be retried', async () => {
  const c = clock();
  const t = { authorize: (_url, opts) => { opts.windowCallback(null); return new Promise(() => {}); } };
  await assert.rejects(authorizeWithPopup(t, 'https://trello.com/1/authorize', c.options), /blockiert/);
  assert.equal(c.size, 0);
});
test('closing a popup or exceeding the timeout ends the pending flow', async () => {
  for (const kind of ['poll', 'timeout']) {
    const c = clock();
    const popup = { closed: false };
    const t = { authorize: (_url, opts) => { opts.windowCallback(popup); return new Promise(() => {}); } };
    const p = authorizeWithPopup(t, 'https://trello.com/1/authorize', c.options);
    popup.closed = true; c.run(kind);
    await assert.rejects(p, kind === 'poll' ? /geschlossen/ : /lange/);
    assert.equal(c.size, 0);
  }
});
test('successful authorization returns opaque token and clears timers', async () => {
  const c = clock();
  const t = { authorize: (_url, opts) => { opts.windowCallback({ closed: false }); return Promise.resolve('opaque-test-token'); } };
  assert.equal(await authorizeWithPopup(t, 'https://trello.com/1/authorize', c.options), 'opaque-test-token');
  assert.equal(c.size, 0);
});
