import { AUTH_KEY, SETTINGS_KEY, badgeFor, ruleFor } from './domain.js';
import { createApi } from './api.js';

const api = createApi();
const icon = new URL('../assets/clock.svg', import.meta.url).href;
const settingsUrl = new URL('../settings.html', import.meta.url).href;
const authUrl = new URL('../authorize.html', import.meta.url).href;

function settings(t, listId) {
  return t.popup({ title: 'Productivity · Phasen', url: settingsUrl, height: 560, args: { listId: listId ?? '' } });
}

function authorize(t) {
  return t.popup({ title: 'Productivity verbinden', url: authUrl, height: 470 });
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
    const text = error.code === 'setup' ? 'Productivity einrichten'
      : error.code === 'auth' ? 'Productivity verbinden'
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
  'board-buttons': () => [{ icon: { dark: icon, light: icon }, text: 'Productivity', callback: t => settings(t) }],
  'card-buttons': () => [{ icon, text: 'Phasenzeit einstellen', callback: async t => settings(t, (await t.card('idList')).idList) }],
  'list-actions': t => [{ text: 'Productivity · Warnschwellen …', callback: ctx => settings(ctx, t.getContext().list) }],
  'show-settings': t => settings(t),
  'authorization-status': async t => {
    const [config, auth] = await Promise.all([t.get('board', 'shared', SETTINGS_KEY, {}), t.get('member', 'private', AUTH_KEY, null)]);
    return { authorized: Boolean(auth?.token && config.appKey && auth.appKey === config.appKey) };
  },
  'show-authorization': authorize,
});
