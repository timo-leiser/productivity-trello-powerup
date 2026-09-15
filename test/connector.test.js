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
  const t = { card: async () => ({ id: 'card', idList: 'list' }), get: async () => ({}) };
  const badge = await handlers['card-badges'](t)[0].dynamic();
  assert.equal(badge.text, 'Productivity verbinden');
  assert.equal(badge.refresh, 60);
  const detail = await handlers['card-detail-badges'](t)[0].dynamic();
  assert.equal(detail.title, 'Productivity');
  assert.equal(typeof detail.callback, 'function');
});
test('list menu opens exactly the selected phase', async () => {
  let popup;
  const t = { getContext: () => ({ list: 'phase-2' }), popup: async value => { popup = value; } };
  await handlers['list-actions'](t)[0].callback(t);
  assert.equal(popup.args.listId, 'phase-2');
  assert.equal(popup.height, SETTINGS_POPUP_HEIGHT);
});
test('board settings and authorization open at their reserved content heights', async () => {
  let popup;
  const t = { popup: async value => { popup = value; } };
  await handlers['board-buttons']()[0].callback(t);
  assert.equal(popup.height, SETTINGS_POPUP_HEIGHT);
  await handlers['show-settings'](t);
  assert.equal(popup.height, SETTINGS_POPUP_HEIGHT);
  await handlers['show-authorization'](t);
  assert.equal(popup.height, AUTH_POPUP_HEIGHT);
});
test('authorization status only accepts a token for the current key', async () => {
  const t = { get: async (_scope, _visibility, key) => key === SETTINGS_KEY ? { appKey: 'a' } : { appKey: 'b', token: 'test' } };
  assert.deepEqual(await handlers['authorization-status'](t), { authorized: false });
  t.get = async () => ({ appKey: APP_KEY, token: 'test' });
  assert.deepEqual(await handlers['authorization-status'](t), { authorized: true });
});
