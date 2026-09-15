import { SETTINGS_KEY, badgeFor, ruleFor } from './domain.js?v=20260915-phase-colors';
import { createApi, credentials } from './api.js';
import { SETTINGS_POPUP_HEIGHT, AUTH_POPUP_HEIGHT } from './popup-layout.js?v=20260915-phase-colors';

const api = createApi();
const icon = new URL('../assets/clock.svg', import.meta.url).href;
const settingsUrl = new URL('../settings.html?v=20260915-phase-colors', import.meta.url).href;
const authUrl = new URL('../authorize.html?v=20260915-phase-colors', import.meta.url).href;

async function settings(t, listId) {
  if (listId) return t.popup({ title: 'Productivity · Phase', url: settingsUrl, height: SETTINGS_POPUP_HEIGHT, args: { listId } });
  // The generic Power-Up settings entry remains useful without a board button.
  const lists = await t.lists('id', 'name');
  return t.popup({ title: 'Productivity · Phase einstellen', items: [
    ...lists.map(list => ({ text: list.name, callback: ctx => settings(ctx, list.id) })),
    { text: 'Trello-Verbindung verwalten', callback: authorize },
  ] });
}

function authorize(t) {
  return t.popup({ title: 'Productivity verbinden', url: authUrl, height: AUTH_POPUP_HEIGHT });
}

async function badge(t, detail = false) {
  try {
    const card = await t.card('id', 'idList', 'dateLastActivity');
    const [config, entry] = await Promise.all([
      t.get('board', 'shared', SETTINGS_KEY, {}), api.entry(t, card),
    ]);
    const result = { ...badgeFor(entry, ruleFor(config, card.idList)), refresh: 60 };
    if (detail) {
      result.title = 'Zeit in dieser Phase';
      result.callback = ctx => settings(ctx, card.idList);
    } else result.icon = icon;
    return result;
  } catch (error) {
    const text = error.code === 'auth' ? 'Productivity verbinden'
        : error.code === 'rate' ? 'Phasenzeit · später erneut'
          : 'Phasenzeit nicht verfügbar';
    return {
      text, color: 'light-gray', refresh: 60,
      ...(detail ? { title: 'Productivity', callback: authorize } : { icon }),
    };
  }
}

// Capability handlers return immediately. Only dynamic badges request history.
window.TrelloPowerUp.initialize({
  'card-badges': t => [{ dynamic: () => badge(t) }],
  'card-detail-badges': t => [{ dynamic: () => badge(t, true) }],
  'board-buttons': () => [],
  'card-buttons': () => [{ icon, text: 'Phasenzeit einstellen', callback: async t => settings(t, (await t.card('idList')).idList) }],
  'list-actions': t => [{ text: 'Productivity · Warnschwellen …', callback: ctx => settings(ctx, t.getContext().list) }],
  'show-settings': t => settings(t),
  'authorization-status': async t => {
    try { await credentials(t); return { authorized: true }; }
    catch { return { authorized: false }; }
  },
  'show-authorization': authorize,
  'on-enable': t => t.modal({ title: 'Willkommen bei Productivity', url: authUrl, height: AUTH_POPUP_HEIGHT }),
});
