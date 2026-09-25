import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_KEY } from '../docs/js/domain.js';
import { APP_KEY } from '../docs/js/config.js';
import { SETTINGS_POPUP_HEIGHT, AUTH_POPUP_HEIGHT } from '../docs/js/popup-layout.js';
let handlers;
globalThis.window = { TrelloPowerUp: { initialize: value => { handlers = value; } } };
await import('../docs/js/connector.js');

test('registers all documented capabilities and returns dynamic badge descriptors immediately', () => {
  assert.deepEqual(Object.keys(handlers).sort(), ['card-badges', 'card-detail-badges', 'board-buttons', 'card-buttons', 'list-actions', 'show-settings', 'authorization-status', 'show-authorization', 'on-enable'].sort());
  assert.equal(typeof handlers['card-badges']({})[0].dynamic, 'function');
  assert.equal(typeof handlers['card-detail-badges']({})[0].dynamic, 'function');
  assert.ok(Array.isArray(handlers['list-actions']({})));
});
test('unauthorized badge guides setup and never starts an API request', async () => {
  const t = { card: async () => ({ id: 'card', idList: 'list' }), board: async () => ({ id: 'board' }), get: async () => ({}) };
  const badge = await handlers['card-badges'](t)[0].dynamic();
  assert.equal(badge.text, 'Connect Productivity');
  assert.equal(badge.refresh, 60);
  const detail = await handlers['card-detail-badges'](t)[0].dynamic();
  assert.equal(detail.title, 'Productivity');
  assert.equal(typeof detail.callback, 'function');
});
test('a stalled badge answers before Trello times out and requests a fast refresh', async () => {
  const pending = new Promise(() => {});
  const started = Date.now();
  const badge = await handlers['card-badges']({ card: () => pending, board: () => pending, get: () => pending })[0].dynamic();
  assert.equal(badge.text, 'Loading phase time…');
  assert.equal(badge.refresh, 10);
  assert.ok(Date.now() - started < 1500);
});
test('list menu opens exactly the selected phase', async () => {
  let popup;
  const t = { getContext: () => ({ list: 'phase-2' }), popup: async value => { popup = value; } };
  await handlers['list-actions'](t)[0].callback(t);
  assert.equal(popup.args.listId, 'phase-2');
  assert.equal(popup.height, SETTINGS_POPUP_HEIGHT);
});
test('generic settings offer one action per phase and no board button', async () => {
  let popup;
  const t = { lists: async () => [{ id: 'one', name: 'First' }, { id: 'two', name: 'Second' }], popup: async value => { popup = value; } };
  assert.deepEqual(handlers['board-buttons'](), []);
  await handlers['show-settings'](t);
  assert.deepEqual(popup.items.map(item => item.text), ['First', 'Second', 'Manage Trello connection']);
  await popup.items[1].callback(t);
  assert.equal(popup.args.listId, 'two');
  assert.equal(popup.height, SETTINGS_POPUP_HEIGHT);
  await handlers['show-authorization'](t);
  assert.equal(popup.height, AUTH_POPUP_HEIGHT);
});
test('generic settings on an empty board retain an authorization action', async () => {
  let popup;
  const t = { lists: async () => [], popup: async value => { popup = value; } };
  await handlers['show-settings'](t);
  assert.equal(popup.items.length, 1);
  await popup.items[0].callback(t);
  assert.ok(popup.url.includes('authorize.html'));
});
test('UI callbacks finish without waiting for Trello popup and modal promises', async () => {
  const pending = new Promise(() => {});
  let popup;
  const t = {
    getContext: () => ({ list: 'phase' }),
    lists: async () => [{ id: 'phase', name: 'Phase' }],
    popup: value => { popup = value; return pending; },
    modal: () => pending,
    card: () => pending,
  };
  assert.equal(handlers['list-actions'](t)[0].callback(t), undefined);
  assert.equal(popup.args.listId, 'phase');
  assert.equal(await handlers['show-settings'](t), undefined);
  assert.equal(handlers['show-authorization'](t), undefined);
  assert.equal(handlers['on-enable'](t), undefined);
  assert.equal(handlers['card-buttons'](t)[0].callback(t), undefined);
});
test('authorization status only accepts a token for the current key', async () => {
  const t = { get: async (_scope, _visibility, key) => key === SETTINGS_KEY ? { appKey: 'a' } : { appKey: 'b', token: 'test' } };
  assert.deepEqual(await handlers['authorization-status'](t), { authorized: false });
  t.get = async () => ({ appKey: APP_KEY, token: 'test' });
  assert.deepEqual(await handlers['authorization-status'](t), { authorized: true });
});
