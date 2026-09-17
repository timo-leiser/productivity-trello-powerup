import { SETTINGS_KEY, badgeFor, ruleFor } from './domain.js?v=20260917-review';
import { createApi, credentials } from './api.js';
import { SETTINGS_POPUP_HEIGHT, AUTH_POPUP_HEIGHT } from './popup-layout.js?v=20260917-review';

const api = createApi();
const icon = new URL('../assets/clock.svg', import.meta.url).href;
const settingsUrl = new URL('../settings.html?v=20260917-review', import.meta.url).href;
const authUrl = new URL('../authorize.html?v=20260917-review', import.meta.url).href;

function launchPopup(t, options) {
  // Trello keeps popup promises pending until the UI closes. Capability callbacks
  // must finish immediately or PluginRunner reports callback timeouts.
  Promise.resolve(t.popup(options)).catch(() => {});
}

function openPhaseSettings(t, listId) {
  launchPopup(t, { title: 'Productivity · Phase', url: settingsUrl, height: SETTINGS_POPUP_HEIGHT, args: { listId } });
}

async function openSettingsMenu(t) {
  const lists = await t.lists('id', 'name');
  launchPopup(t, { title: 'Productivity · Configure a phase', items: [
    ...lists.map(list => ({ text: list.name, callback: ctx => { openPhaseSettings(ctx, list.id); } })),
    { text: 'Manage Trello connection', callback: ctx => { openAuthorization(ctx); } },
  ] });
}

function openAuthorization(t) {
  launchPopup(t, { title: 'Connect Productivity', url: authUrl, height: AUTH_POPUP_HEIGHT });
}

async function badge(t, detail = false) {
  try {
    const card = await t.card('id', 'idList', 'dateLastActivity');
    const [config, entry] = await Promise.all([
      t.get('board', 'shared', SETTINGS_KEY, {}), api.entry(t, card),
    ]);
    const result = { ...badgeFor(entry, ruleFor(config, card.idList)), refresh: 60 };
    if (detail) {
      result.title = 'Time in this phase';
      result.callback = ctx => { openPhaseSettings(ctx, card.idList); };
    } else result.icon = icon;
    return result;
  } catch (error) {
    const text = error.code === 'auth' ? 'Connect Productivity'
        : error.code === 'rate' ? 'Phase time · try later'
          : 'Phase time unavailable';
    return {
      text, color: 'light-gray', refresh: 60,
      ...(detail ? { title: 'Productivity', callback: ctx => { openAuthorization(ctx); } } : { icon }),
    };
  }
}

// Capability handlers return immediately. Only dynamic badges request history.
window.TrelloPowerUp.initialize({
  'card-badges': t => [{ dynamic: () => badge(t) }],
  'card-detail-badges': t => [{ dynamic: () => badge(t, true) }],
  'board-buttons': () => [],
  'card-buttons': () => [{ icon, text: 'Configure phase time', callback: async t => { openPhaseSettings(t, (await t.card('idList')).idList); } }],
  'list-actions': t => [{ text: 'Productivity · Time thresholds …', callback: ctx => { openPhaseSettings(ctx, t.getContext().list); } }],
  'show-settings': t => openSettingsMenu(t),
  'authorization-status': async t => {
    try { await credentials(t); return { authorized: true }; }
    catch { return { authorized: false }; }
  },
  'show-authorization': t => { openAuthorization(t); },
  'on-enable': t => { Promise.resolve(t.modal({ title: 'Welcome to Productivity', url: authUrl, height: AUTH_POPUP_HEIGHT })).catch(() => {}); },
});
