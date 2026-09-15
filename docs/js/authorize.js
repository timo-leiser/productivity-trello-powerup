import { AUTH_KEY } from './domain.js';
import { APP_KEY } from './config.js';
import { authorizeWithPopup } from './auth-flow.js';
import { demoClient } from './demo-client.js';
import { popupLayout, AUTH_POPUP_HEIGHT } from './popup-layout.js';

const demo = new URLSearchParams(location.search).get('demo') === '1';
const t = demo ? demoClient() : window.TrelloPowerUp.iframe();
const $ = id => document.getElementById(id);
const { resize, ready } = popupLayout(t, demo, AUTH_POPUP_HEIGHT);

async function load() {
  const auth = await t.get('member', 'private', AUTH_KEY, null);
  const connected = Boolean(auth?.token && auth.appKey === APP_KEY);
  $('auth-status').textContent = connected ? 'Dein Trello-Konto ist verbunden.' : 'Bereit zum Verbinden. Es ist kein weiteres Konto nötig.';
  if (demo) $('auth-status').textContent = 'Demo · Die Verbindung ist hier nur eine Vorschau.';
  $('authorize').disabled = demo;
  $('authorize').textContent = connected ? 'Erneut verbinden' : 'Mit Trello verbinden';
  $('disconnect').hidden = !connected;
  resize();
}

$('authorize').addEventListener('click', async () => {
  if (demo) return;
  const url = new URL('https://trello.com/1/authorize');
  const callback = new URL('../auth-callback.html', import.meta.url);
  Object.entries({ key: APP_KEY, name: 'Productivity', expiration: 'never', response_type: 'token', scope: 'read', callback_method: 'fragment', return_url: callback.href }).forEach(([k, v]) => url.searchParams.set(k, v));
  $('authorize').disabled = true;
  try {
    // Call directly from the user's click to avoid popup blockers.
    const token = await authorizeWithPopup(t, url.href);
    if (typeof token !== 'string' || !token) throw new Error('Die Freigabe wurde nicht abgeschlossen.');
    await t.set('member', 'private', AUTH_KEY, { appKey: APP_KEY, token });
    await load();
    $('auth-status').textContent = 'Verbunden. Öffne Productivity, um Warnschwellen einzustellen. Phasenzeiten erscheinen in Kürze.';
  } catch (error) { $('auth-status').textContent = error.message || 'Verbindung nicht abgeschlossen. Bitte erneut versuchen.'; }
  finally { $('authorize').disabled = false; resize(); }
});
$('disconnect').addEventListener('click', async () => {
  try {
    await t.remove('member', 'private', AUTH_KEY);
    await load();
    $('auth-status').textContent = 'Verbindung entfernt. Die Freigabe kannst du zusätzlich unter trello.com/my/account widerrufen.';
  } catch { $('auth-status').textContent = 'Verbindung konnte nicht entfernt werden. Bitte erneut versuchen.'; }
  resize();
});
load().catch(() => { $('auth-status').textContent = 'Öffne diese Ansicht über Productivity in deinem Trello-Board.'; }).finally(ready);
