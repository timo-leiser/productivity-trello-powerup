import { AUTH_KEY, SETTINGS_KEY, findListEntry } from './domain.js';

const FILTER = 'updateCard:idList,createCard,copyCard,convertToCardFromCheckItem,emailCard,moveCardToBoard';
export class TrelloError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

export async function credentials(t) {
  const [settings, auth] = await Promise.all([
    t.get('board', 'shared', SETTINGS_KEY, {}),
    t.get('member', 'private', AUTH_KEY, null),
  ]);
  if (!settings.appKey) throw new TrelloError('setup', 'Productivity zuerst einrichten.');
  if (!auth?.token || auth.appKey !== settings.appKey) throw new TrelloError('auth', 'Bitte mit Trello verbinden.');
  return { key: settings.appKey, token: auth.token };
}

// Queue starts at most 5 requests per second, below Trello's per-token rate limit.
export function createApi({ fetchImpl = globalThis.fetch, now = Date.now, sleep = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  let queue = Promise.resolve();
  let nextStart = 0;
  let blockedUntil = 0;
  const cache = new Map();
  const inFlight = new Map();

  async function request(auth, path, params) {
    const turn = queue.then(async () => {
      await sleep(Math.max(0, nextStart - now()));
      nextStart = now() + 210;
      if (now() < blockedUntil) throw new TrelloError('rate', 'Trello ist ausgelastet. Erneuter Versuch in einer Minute.');
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
    } catch { throw new TrelloError('network', 'Trello ist gerade nicht erreichbar.'); }
    if (response.status === 401) throw new TrelloError('auth', 'Verbindung abgelaufen. Bitte erneut verbinden.');
    if (response.status === 403) throw new TrelloError('access', 'Kein Zugriff auf diese Kartenhistorie.');
    if (response.status === 429) {
      blockedUntil = now() + 60_000;
      throw new TrelloError('rate', 'Trello ist ausgelastet. Erneuter Versuch in einer Minute.');
    }
    if (!response.ok) throw new TrelloError('network', 'Kartenhistorie konnte nicht geladen werden.');
    return response.json();
  }

  async function loadEntry(auth, card) {
    const actions = [];
    let before;
    // Pagination handles imported cards and histories with many transitions.
    for (let page = 0; page < 20; page++) {
      const params = { filter: FILTER, fields: 'id,type,date,data', limit: 100, memberCreator: false };
      if (before) params.before = before;
      const batch = await request(auth, `cards/${encodeURIComponent(card.id)}/actions`, params);
      if (!Array.isArray(batch)) throw new TrelloError('network', 'Unerwartete Antwort von Trello.');
      actions.push(...batch);
      const entry = findListEntry(actions, card);
      if (entry || batch.length < 100) return entry;
      const cursor = batch.at(-1)?.id;
      if (!cursor || cursor === before) break;
      before = cursor;
    }
    return null;
  }

  return {
    async entry(t, card) {
      const auth = await credentials(t);
      // Changes and moves invalidate the cache, including a round trip into the same list.
      const key = JSON.stringify([auth.key, auth.token, card.id, card.idList, card.dateLastActivity]);
      const hit = cache.get(key);
      if (hit && now() - hit.at < (hit.error ? 30_000 : 60_000)) {
        if (hit.error) throw hit.error;
        return hit.value;
      }
      if (inFlight.has(key)) return inFlight.get(key);
      const promise = loadEntry(auth, card).then(value => {
        if (cache.size > 1000) cache.clear();
        cache.set(key, { at: now(), value });
        return value;
      }, error => { cache.set(key, { at: now(), error }); throw error; })
        .finally(() => inFlight.delete(key));
      inFlight.set(key, promise);
      return promise;
    },
    clear() { cache.clear(); },
  };
}
