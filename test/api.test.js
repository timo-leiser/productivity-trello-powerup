import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, credentials } from '../docs/js/api.js';
import { SETTINGS_KEY, AUTH_KEY } from '../docs/js/domain.js';
import { APP_KEY } from '../docs/js/config.js';

const card = { id: 'abc', idList: 'doing', dateLastActivity: '2026-09-15T00:00:00Z' };
const entry = { id: 'entry', type: 'createCard', date: '2026-09-01T00:00:00Z', data: { card: { id: card.id }, list: { id: card.idList } } };
const client = (auth = { appKey: APP_KEY, token: 'private-test-token' }) => ({ get: async (_s, _v, field) => field === AUTH_KEY ? auth : null });
const ok = body => ({ ok: true, status: 200, json: async () => body });
const sleep = async () => {};

test('requires a private member token for the fixed public app key', async () => {
  await assert.rejects(credentials(client(null)), { code: 'auth' });
  await assert.rejects(credentials(client({ appKey: 'other', token: 'x' })), { code: 'auth' });
  assert.deepEqual(await credentials(client()), { key: APP_KEY, token: 'private-test-token' });
  const t = { get: async (_s, _v, field) => field === SETTINGS_KEY ? { appKey: 'injected-key' } : { appKey: 'injected-key', token: 'x' } };
  await assert.rejects(credentials(t), { code: 'auth' });
});
test('deduplicates simultaneous badges, caches briefly and invalidates list/activity changes', async () => {
  const requests = [];
  let time = 1000;
  const api = createApi({ now: () => time, sleep, fetchImpl: async (url, opts) => { requests.push({ url, opts }); return ok([entry]); } });
  const [a, b] = await Promise.all([api.entry(client(), card), api.entry(client(), card)]);
  assert.deepEqual(a, b); assert.equal(requests.length, 1);
  await api.entry(client(), card); assert.equal(requests.length, 1);
  await api.entry(client(), { ...card, idList: 'review' }); assert.equal(requests.length, 2);
  await api.entry(client(), { ...card, dateLastActivity: '2026-09-16T00:00:00Z' }); assert.equal(requests.length, 3);
  time += 60_001; await api.entry(client(), card); assert.equal(requests.length, 4);
  assert.ok(requests[0].opts.headers.Authorization.includes('private-test-token'));
  assert.ok(!requests[0].url.href.includes('private-test-token'));
  assert.equal(requests[0].url.searchParams.get('filter').includes('updateCard:idList'), true);
});
test('paginates through incomplete batches to a real entry', async () => {
  const requests = [];
  const batch = Array.from({ length: 100 }, (_, i) => ({ id: `ignored-${i}`, type: 'updateCard', date: '2026-09-03T00:00:00Z', data: {} }));
  const api = createApi({ sleep, fetchImpl: async url => { requests.push(url); return ok(requests.length === 1 ? batch : [entry]); } });
  assert.equal((await api.entry(client(), card)).actionId, 'entry');
  assert.equal(requests[1].searchParams.get('before'), 'ignored-99');
});
test('auth errors do not expose tokens and are briefly cached', async () => {
  let calls = 0;
  const api = createApi({ sleep, fetchImpl: async () => { calls++; return { ok: false, status: 401 }; } });
  await assert.rejects(api.entry(client(), card), { code: 'auth' });
  await assert.rejects(api.entry(client(), card), { code: 'auth' });
  assert.equal(calls, 1);
});
test('rate limiting backs off across cards and recovers after a minute', async () => {
  let calls = 0; let time = 1000;
  const api = createApi({ now: () => time, sleep, fetchImpl: async () => { calls++; return calls === 1 ? { ok: false, status: 429 } : ok([entry]); } });
  await assert.rejects(api.entry(client(), card), { code: 'rate' });
  await assert.rejects(api.entry(client(), { ...card, id: 'another' }), { code: 'rate' });
  assert.equal(calls, 1);
  time += 60_001;
  assert.ok(await api.entry(client(), card)); assert.equal(calls, 2);
});
test('revoking/changing authentication never reuses a cached authorized result', async () => {
  let calls = 0;
  const api = createApi({ sleep, fetchImpl: async () => { calls++; return ok([entry]); } });
  await api.entry(client(), card);
  await assert.rejects(api.entry(client(null), card), { code: 'auth' });
  await api.entry(client({ appKey: APP_KEY, token: 'different-token' }), card);
  assert.equal(calls, 2);
});
test('network and access failures stay distinct from unknown history', async () => {
  const offline = createApi({ sleep, fetchImpl: async () => { throw new Error('network with sensitive details'); } });
  await assert.rejects(offline.entry(client(), card), { code: 'network', message: 'Trello is currently unavailable.' });
  const forbidden = createApi({ sleep, fetchImpl: async () => ({ ok: false, status: 403 }) });
  await assert.rejects(forbidden.entry(client(), card), { code: 'access' });
  const empty = createApi({ sleep, fetchImpl: async () => ok([]) });
  assert.equal(await empty.entry(client(), card), null);
});
