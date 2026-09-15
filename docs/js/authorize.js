import { AUTH_KEY, SETTINGS_KEY } from './domain.js';
import { demoClient } from './demo-client.js';

const demo = new URLSearchParams(location.search).get('demo') === '1';
const t = demo ? demoClient() : window.TrelloPowerUp.iframe();
const $ = id => document.getElementById(id);
let appKey = '';
let writable = false;
function resize() { t.sizeTo('#app').catch(() => {}); }

async function load() {
  const [settings, auth] = await Promise.all([t.get('board', 'shared', SETTINGS_KEY, {}), t.get('member', 'private', AUTH_KEY, null)]);
  appKey = settings.appKey ?? '';
  writable = t.memberCanWriteToModel('board');
  $('app-key').value = appKey;
  $('app-key').disabled = !writable;
  $('key-form').querySelector('button').disabled = !writable;
  $('key-section').open = !appKey;
  const connected = Boolean(auth?.token && auth.appKey === appKey);
  $('auth-status').textContent = connected ? 'Dein Trello-Konto ist verbunden.' : appKey ? 'Bereit zum Verbinden.' : writable ? 'Speichere zuerst den API-Key deines Power-Ups.' : 'Ein Board-Mitglied muss zuerst den API-Key eintragen.';
  if (demo) $('auth-status').textContent = 'Demo · Die Verbindung ist hier nur eine Vorschau.';
  $('authorize').disabled = !appKey || demo;
  $('authorize').textContent = connected ? 'Erneut verbinden' : 'Mit Trello verbinden';
  $('disconnect').hidden = !connected;
  resize();
}

$('key-form').addEventListener('submit', async event => {
  event.preventDefault(); if (!writable) return;
  try {
    const value = $('app-key').value.trim();
    if (!/^[a-f0-9]{32}$/i.test(value)) throw new Error('Bitte den 32-stelligen öffentlichen API-Key eingeben, keinen Token oder Secret.');
    const config = await t.get('board', 'shared', SETTINGS_KEY, {});
    const next = { ...config, appKey: value, version: 1 };
    if (JSON.stringify({ [SETTINGS_KEY]: next }).length > 3900) throw new Error('Der Trello-Speicher für dieses Board ist voll.');
    await t.set('board', 'shared', SETTINGS_KEY, next);
    await load();
  } catch (error) { $('auth-status').textContent = error.message || 'Speichern fehlgeschlagen.'; resize(); }
});

$('authorize').addEventListener('click', async () => {
  if (!appKey || demo) return;
  const url = new URL('https://trello.com/1/authorize');
  const callback = new URL('../auth-callback.html', import.meta.url);
  Object.entries({ key: appKey, name: 'Productivity', expiration: 'never', response_type: 'token', scope: 'read', callback_method: 'fragment', return_url: callback.href }).forEach(([k, v]) => url.searchParams.set(k, v));
  $('authorize').disabled = true;
  try {
    // Call directly from the user's click to avoid popup blockers.
    const token = await t.authorize(url.href, { width: 600, height: 740 });
    if (typeof token !== 'string' || !token) throw new Error('Die Freigabe wurde nicht abgeschlossen.');
    await t.set('member', 'private', AUTH_KEY, { appKey, token });
    await load();
    $('auth-status').textContent = 'Verbunden. Schließe dieses Fenster; die Phasenzeiten erscheinen innerhalb einer Minute.';
  } catch { $('auth-status').textContent = 'Verbindung nicht abgeschlossen. Bitte Pop-ups erlauben und erneut versuchen.'; }
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
$('key-section').addEventListener('toggle', resize);
load().catch(() => { $('auth-status').textContent = 'Öffne diese Ansicht über Productivity in deinem Trello-Board.'; });
