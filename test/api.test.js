import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, credentials } from '../docs/js/api.js';
import { SETTINGS_KEY, AUTH_KEY } from '../docs/js/domain.js';
import { APP_KEY } from '../docs/js/config.js';

const card = { id: 'abc', idList: 'doing', dateLastActivity: '2026-09-15T00:00:00Z' };
const board = { id: 'board', dateLastActivity: '2026-09-15T00:00:00Z' };
const moveEntry = { id: 'entry', type: 'updateCard', date: '2026-09-01T00:00:00Z', data: { card: { id: card.id }, listBefore: { id: 'ideas' }, listAfter: { id: card.idList } } };
const createEntry = { id: 'create', type: 'createCard', date: '2026-08-01T00:00:00Z', data: { card: { id: card.id }, list: { id: card.idList } } };
const boardCreated = { id: 'board-created', type: 'createBoard', date: '2026-07-01T00:00:00Z', data: { board: { id: board.id } } };
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

test('deduplicates simultaneous badges, caches briefly and invalidates card/board changes', async () => {
  const requests = [];
  let time = 1000;
  const api = createApi({ now: () => time, sleep, fetchImpl: async (url, opts) => { requests.push({ url, opts }); return ok([moveEntry]); } });
  const [a, b] = await Promise.all([api.entry(client(), card, board), api.entry(client(), card, board)]);
  assert.deepEqual(a, b); assert.equal(requests.length, 1);
  await api.entry(client(), card, board); assert.equal(requests.length, 1);
  await api.entry(client(), { ...card, idList: 'review' }, board); assert.equal(requests.length, 2);
  await api.entry(client(), { ...card, dateLastActivity: '2026-09-16T00:00:00Z' }, board); assert.equal(requests.length, 3);
  await api.entry(client(), card, { ...board, dateLastActivity: '2026-09-17T00:00:00Z' }); assert.equal(requests.length, 4);
  time += 60_001; await api.entry(client(), card, board); assert.equal(requests.length, 5);
  assert.ok(requests[0].opts.headers.Authorization.includes('private-test-token'));
  assert.ok(!requests[0].url.href.includes('private-test-token'));
  assert.equal(requests[0].url.searchParams.get('filter').includes('updateCard:idList'), true);
});

test('paginates card history to the most recent real list entry', async () => {
  const requests = [];
  const batch = Array.from({ length: 1000 }, (_, i) => ({ id: `ignored-${i}`, type: 'updateCard', date: '2026-09-03T00:00:00Z', data: {} }));
  const api = createApi({ sleep, fetchImpl: async url => { requests.push(url); return ok(requests.length === 1 ? batch : [moveEntry]); } });
  assert.equal((await api.entry(client(), card, board)).actionId, 'entry');
  assert.equal(requests[1].searchParams.get('before'), 'ignored-999');
});

test('uses board history for card creation actions absent from nested card history', async () => {
  const requests = [];
  const api = createApi({ sleep, fetchImpl: async url => {
    requests.push(url);
    return ok(url.pathname.includes('/cards/') ? [] : [createEntry, boardCreated]);
  } });
  const result = await api.entry(client(), card, board);
  assert.equal(result.actionId, 'create');
  assert.equal(result.source, 'createCard');
  assert.equal(requests.filter(url => url.pathname.includes('/boards/')).length, 1);
});

test('uses a recorded board-copy event for cards cloned with the board', async () => {
  const copyBoard = { id: 'copied', type: 'copyBoard', date: '2026-09-10T12:00:00Z', data: { board: { id: board.id } } };
  const api = createApi({ sleep, fetchImpl: async url => ok(url.pathname.includes('/cards/') ? [] : [copyBoard]) });
  assert.deepEqual(await api.entry(client(), card, board), {
    enteredAt: Date.parse(copyBoard.date), actionId: copyBoard.id, source: 'copyBoard',
  });
});

test('shares one board-origin request between simultaneous cards', async () => {
  const other = { ...card, id: 'def' };
  const otherCreate = { ...createEntry, id: 'create-2', data: { ...createEntry.data, card: { id: other.id } } };
  let boardRequests = 0;
  const api = createApi({ sleep, fetchImpl: async url => {
    if (url.pathname.includes('/cards/')) return ok([]);
    boardRequests++;
    return ok([createEntry, otherCreate, boardCreated]);
  } });
  const [first, second] = await Promise.all([api.entry(client(), card, board), api.entry(client(), other, board)]);
  assert.equal(first.actionId, createEntry.id);
  assert.equal(second.actionId, otherCreate.id);
  assert.equal(boardRequests, 1);
});

test('auth errors do not expose tokens and are briefly cached', async () => {
  let calls = 0;
  const api = createApi({ sleep, fetchImpl: async () => { calls++; return { ok: false, status: 401 }; } });
  await assert.rejects(api.entry(client(), card, board), { code: 'auth' });
  await assert.rejects(api.entry(client(), card, board), { code: 'auth' });
  assert.equal(calls, 1);
});

test('rate limiting backs off across cards and recovers after a minute', async () => {
  let calls = 0; let time = 1000;
  const api = createApi({ now: () => time, sleep, fetchImpl: async () => { calls++; return calls === 1 ? { ok: false, status: 429 } : ok([moveEntry]); } });
  await assert.rejects(api.entry(client(), card, board), { code: 'rate' });
  await assert.rejects(api.entry(client(), { ...card, id: 'another' }, board), { code: 'rate' });
  assert.equal(calls, 1);
  time += 60_001;
  assert.ok(await api.entry(client(), card, board)); assert.equal(calls, 2);
});

test('revoking/changing authentication never reuses a cached authorized result', async () => {
  let calls = 0;
  const api = createApi({ sleep, fetchImpl: async () => { calls++; return ok([moveEntry]); } });
  await api.entry(client(), card, board);
  await assert.rejects(api.entry(client(null), card, board), { code: 'auth' });
  await api.entry(client({ appKey: APP_KEY, token: 'different-token' }), card, board);
  assert.equal(calls, 2);
});

test('network and access failures stay distinct from unknown history', async () => {
  const offline = createApi({ sleep, fetchImpl: async () => { throw new Error('network with sensitive details'); } });
  await assert.rejects(offline.entry(client(), card, board), { code: 'network', message: 'Trello is currently unavailable.' });
  const forbidden = createApi({ sleep, fetchImpl: async () => ({ ok: false, status: 403 }) });
  await assert.rejects(forbidden.entry(client(), card, board), { code: 'access' });
  const empty = createApi({ sleep, fetchImpl: async () => ok([]) });
  assert.equal(await empty.entry(client(), card, board), null);
});
