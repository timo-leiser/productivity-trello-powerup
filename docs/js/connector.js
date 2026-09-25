import { SETTINGS_KEY, badgeFor, ruleFor } from './domain.js?v=20260925-review2';
import { createApi, credentials } from './api.js?v=20260925-review2';
import { SETTINGS_POPUP_HEIGHT, AUTH_POPUP_HEIGHT } from './popup-layout.js?v=20260925-review2';

const api = createApi();
const icon = new URL('../assets/clock.svg', import.meta.url).href;
const settingsUrl = new URL('../settings.html?v=20260925-review2', import.meta.url).href;
const authUrl = new URL('../authorize.html?v=20260925-review2', import.meta.url).href;
export const BADGE_DEADLINE_MS = 800;

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

function loadingBadge(detail) {
  return {
    text: 'Loading phase time…', color: 'light-gray', refresh: 10,
    ...(detail ? { title: 'Productivity' } : { icon }),
  };
}

function withinDeadline(promise, fallback, delay = BADGE_DEADLINE_MS) {
  let timer;
  const timeout = new Promise(resolve => { timer = setTimeout(() => resolve(fallback), delay); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function loadBadge(t, detail = false) {
  try {
    const [card, board, config] = await Promise.all([
      t.card('id', 'idList', 'dateLastActivity'),
      t.board('id', 'dateLastActivity'),
      t.get('board', 'shared', SETTINGS_KEY, {}),
    ]);
    const entry = await api.entry(t, card, board);
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

function badge(t, detail = false) {
  // Trello expects capability callbacks within one second and stops waiting after
  // five. History loading continues in the API cache for the next 10-second refresh.
  return withinDeadline(loadBadge(t, detail), loadingBadge(detail));
}

// Capability handlers return immediately. Only dynamic badges request history.
window.TrelloPowerUp.initialize({
  'card-badges': t => [{ dynamic: () => badge(t) }],
  'card-detail-badges': t => [{ dynamic: () => badge(t, true) }],
  'board-buttons': () => [],
  'card-buttons': () => [{ icon, text: 'Configure phase time', callback: t => {
    Promise.resolve(t.card('idList')).then(card => openPhaseSettings(t, card.idList)).catch(() => {});
  } }],
  'list-actions': t => [{ text: 'Productivity · Time thresholds …', callback: ctx => { openPhaseSettings(ctx, t.getContext().list); } }],
  'show-settings': t => openSettingsMenu(t),
  'authorization-status': async t => {
    try { await credentials(t); return { authorized: true }; }
    catch { return { authorized: false }; }
  },
  'show-authorization': t => { openAuthorization(t); },
  'on-enable': t => { Promise.resolve(t.modal({ title: 'Welcome to Productivity', url: authUrl, height: AUTH_POPUP_HEIGHT })).catch(() => {}); },
});
