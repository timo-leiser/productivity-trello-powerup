import { AUTH_KEY } from './domain.js?v=20260925-review2';
import { APP_KEY } from './config.js';
import { authorizeWithPopup } from './auth-flow.js';
import { demoClient } from './demo-client.js';
import { popupLayout, AUTH_POPUP_HEIGHT } from './popup-layout.js?v=20260925-review2';

const demo = new URLSearchParams(location.search).get('demo') === '1';
const t = demo ? demoClient() : window.TrelloPowerUp.iframe();
const $ = id => document.getElementById(id);
const { resize, ready } = popupLayout(t, demo, AUTH_POPUP_HEIGHT);

async function load() {
  const auth = await t.get('member', 'private', AUTH_KEY, null);
  const connected = Boolean(auth?.token && auth.appKey === APP_KEY);
  $('auth-status').textContent = connected ? 'Your Trello account is connected.' : 'Ready to connect. No additional account is needed.';
  if (demo) $('auth-status').textContent = 'Demo · The connection shown here is only a preview.';
  $('authorize').disabled = demo;
  $('authorize').textContent = connected ? 'Connect again' : 'Connect to Trello';
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
    if (typeof token !== 'string' || !token) throw new Error('Authorization was not completed.');
    await t.set('member', 'private', AUTH_KEY, { appKey: APP_KEY, token });
    await load();
    $('auth-status').textContent = 'Connected. Open ⋯ → Productivity · Time thresholds … on a list. Phase times will appear shortly.';
  } catch (error) { $('auth-status').textContent = error.message || 'Connection was not completed. Try again.'; }
  finally { $('authorize').disabled = false; resize(); }
});
$('disconnect').addEventListener('click', async () => {
  try {
    await t.remove('member', 'private', AUTH_KEY);
    await load();
    $('auth-status').textContent = 'Connection removed. You can also revoke authorization at trello.com/my/account.';
  } catch { $('auth-status').textContent = 'The connection could not be removed. Try again.'; }
  resize();
});
load().catch(() => { $('auth-status').textContent = 'Open this view through Productivity in your Trello board.'; }).finally(ready);
