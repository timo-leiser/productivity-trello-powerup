import { AUTH_KEY, findBoardOrigin, listEntryState } from './domain.js?v=20260925-review2';
import { APP_KEY } from './config.js';

const CARD_FILTER = 'updateCard:idList,moveCardToBoard';
const BOARD_ORIGIN_FILTER = 'createBoard,copyBoard,createCard,copyCard,convertToCardFromCheckItem,emailCard,moveCardToBoard';
export class TrelloError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export async function credentials(t) {
  const auth = await t.get('member', 'private', AUTH_KEY, null);
  if (!auth?.token || auth.appKey !== APP_KEY) throw new TrelloError('auth', 'Connect Productivity to Trello.');
  return { key: APP_KEY, token: auth.token };
}

// Queue starts at most 5 requests per second, below Trello's per-token rate limit.
export function createApi({ fetchImpl = globalThis.fetch, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let queue = Promise.resolve();
  let nextStart = 0;
  let blockedUntil = 0;
  const cache = new Map();
  const inFlight = new Map();
  const boardCache = new Map();
  const boardInFlight = new Map();

  async function request(auth, path, params) {
    const turn = queue.then(async () => {
      await sleep(Math.max(0, nextStart - now()));
      nextStart = now() + 210;
      if (now() < blockedUntil) throw new TrelloError('rate', 'Trello is busy. Try again in one minute.');
    });
    queue = turn.catch(() => {});
    await turn;
    const url = new URL(`https://api.trello.com/1/${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    let response;
    try {
      // Keep credentials out of URLs, browser history and request query logs.
      response = await fetchImpl(url, {
        headers: { Authorization: `OAuth oauth_consumer_key="${encodeURIComponent(auth.key)}", oauth_token="${encodeURIComponent(auth.token)}"` },
        cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12_000),
      });
    } catch { throw new TrelloError('network', 'Trello is currently unavailable.'); }
    if (response.status === 401) throw new TrelloError('auth', 'Your connection expired. Connect again.');
    if (response.status === 403) throw new TrelloError('access', 'You cannot access this card history.');
    if (response.status === 429) {
      blockedUntil = now() + 60_000;
      throw new TrelloError('rate', 'Trello is busy. Try again in one minute.');
    }
    if (!response.ok) throw new TrelloError('network', 'Card history could not be loaded.');
    return response.json();
  }

  async function loadCardEntry(auth, card) {
    const actions = [];
    let before;
    // Card history is the most direct source for moves between lists.
    for (let page = 0; page < 20; page++) {
      const params = { filter: CARD_FILTER, fields: 'id,type,date,data', limit: 1000, memberCreator: false };
      if (before) params.before = before;
      const batch = await request(auth, `cards/${encodeURIComponent(card.id)}/actions`, params);
      if (!Array.isArray(batch)) throw new TrelloError('network', 'Trello returned an unexpected response.');
      actions.push(...batch);
      const state = listEntryState(actions, card);
      if (state.recorded || batch.length === 0) return state;
      const cursor = batch.at(-1)?.id;
      if (!cursor || cursor === before) break;
      before = cursor;
    }
    return listEntryState(actions, card);
  }

  async function loadBoardOrigins(auth, board) {
    const actions = [];
    let before;
    // Creation/copy actions are associated with the board rather than the card.
    // Stop at the board origin because no relevant card origin can predate it.
    for (let page = 0; page < 20; page++) {
      const params = { filter: BOARD_ORIGIN_FILTER, fields: 'id,type,date,data', limit: 1000, memberCreator: false };
      if (before) params.before = before;
      const batch = await request(auth, `boards/${encodeURIComponent(board.id)}/actions`, params);
      if (!Array.isArray(batch)) throw new TrelloError('network', 'Trello returned an unexpected response.');
      actions.push(...batch);
      if (batch.some(action => action.type === 'createBoard' || action.type === 'copyBoard') || batch.length === 0) break;
      const cursor = batch.at(-1)?.id;
      if (!cursor || cursor === before) break;
      before = cursor;
    }
    return actions;
  }

  function origins(auth, board) {
    const key = JSON.stringify([auth.key, auth.token, board.id, board.dateLastActivity]);
    const hit = boardCache.get(key);
    if (hit && now() - hit.at < 60_000) return Promise.resolve(hit.value);
    if (boardInFlight.has(key)) return boardInFlight.get(key);
    const promise = loadBoardOrigins(auth, board).then(value => {
      if (boardCache.size > 100) boardCache.clear();
      boardCache.set(key, { at: now(), value });
      return value;
    }).finally(() => boardInFlight.delete(key));
    boardInFlight.set(key, promise);
    return promise;
  }

  return {
    async entry(t, card, board) {
      const auth = await credentials(t);
      // Changes and moves invalidate the cache, including a round trip into the same list.
      const key = JSON.stringify([auth.key, auth.token, card.id, card.idList, card.dateLastActivity, board.id, board.dateLastActivity]);
      const hit = cache.get(key);
      if (hit && now() - hit.at < (hit.error ? 30_000 : 60_000)) {
        if (hit.error) throw hit.error;
        return hit.value;
      }
      if (inFlight.has(key)) return inFlight.get(key);
      const promise = loadCardEntry(auth, card).then(async state => {
        if (state.recorded) return state.entry;
        return findBoardOrigin(await origins(auth, board), card);
      }).then(value => {
        if (cache.size > 1000) cache.clear();
        cache.set(key, { at: now(), value });
        return value;
      }, error => { cache.set(key, { at: now(), error }); throw error; })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
      return promise;
    },
    clear() { cache.clear(); boardCache.clear(); },
  };
}
