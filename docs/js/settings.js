import { DEFAULT_RULE, HOUR, SETTINGS_KEY, parseThreshold, validateRule, ruleFor, unitFor, statusFor } from './domain.js?v=20260917-review';
import { credentials } from './api.js';
import { demoClient } from './demo-client.js';
import { popupLayout, SETTINGS_POPUP_HEIGHT, AUTH_POPUP_HEIGHT } from './popup-layout.js?v=20260917-review';

const demo = new URLSearchParams(location.search).get('demo') === '1';
const t = demo ? demoClient() : window.TrelloPowerUp.iframe();
const $ = id => document.getElementById(id);
let config = {};
let selected = '';
let unit = 'days';
let dirty = false;
const colors = ['green', 'orange', 'red'];
let writable = false;

const { resize, ready } = popupLayout(t, demo, SETTINGS_POPUP_HEIGHT);
function inputRule() { return Object.fromEntries(colors.map(color => [color, parseThreshold($(color).value, unit)])); }
function values() { return validateRule(inputRule()); }
function display(rule) {
  for (const color of colors) $(color).value = rule[color] === null ? '' : rule[color] / (unit === 'days' ? 24 : 1);
  preview();
}
function displaySaved() {
  unit = unitFor(config, selected);
  $('unit').value = unit;
  display(ruleFor(config, selected));
}
function preview() {
  try {
    $('preview-badge').className = `badge ${statusFor(72 * HOUR, values())}`;
    $('form-message').textContent = dirty ? 'Not saved yet.' : '';
    $('form-message').className = 'help';
  } catch (error) {
    $('form-message').textContent = error.message;
    $('form-message').className = 'error';
  }
  resize();
}

async function init() {
  const [lists, saved] = await Promise.all([t.lists('id', 'name'), t.get('board', 'shared', SETTINGS_KEY, {})]);
  config = saved;
  writable = t.memberCanWriteToModel('board');
  $('demo-note').hidden = !demo;
  if (!lists.length) { $('loading').textContent = 'Create a list on this board first.'; return; }
  const requested = t.arg('listId', '');
  const phase = lists.find(list => list.id === requested);
  if (!phase) { $('loading').textContent = 'Open the list you want through ⋯ → Productivity · Time thresholds …'; return; }
  selected = phase.id;
  $('phase-name').textContent = phase.name;
  displaySaved();
  $('loading').hidden = true;
  $('settings-form').hidden = false;
  $('unit').disabled = !writable;
  for (const id of [...colors, 'save', 'reset']) $(id).disabled = !writable;
  try {
    if (!demo) await credentials(t);
    $('connection').textContent = writable ? 'Connected · Applies to this phase.' : 'Read access · Only board members can save changes.';
  } catch (error) {
    $('connection').textContent = error.code === 'setup' ? 'One-time setup: connect Productivity to Trello below.' : 'Connect your Trello account to see phase times.';
  }
  $('connection').hidden = false;
  resize();
}

$('unit').addEventListener('change', () => {
  try {
    const current = inputRule();
    unit = $('unit').value; dirty = true; display(current);
  } catch (error) { $('unit').value = unit; $('form-message').textContent = error.message; }
});
for (const id of colors) $(id).addEventListener('input', () => { dirty = true; preview(); });
$('reset').addEventListener('click', () => { dirty = true; unit = 'days'; $('unit').value = unit; display(DEFAULT_RULE); });
$('settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!writable) return;
  const listId = selected;
  try {
    const rule = { ...values(), unit };
    for (const control of $('settings-form').querySelectorAll('input, select, button')) control.disabled = true;
    // Read the latest board data before merging just the edited phase.
    const latest = await t.get('board', 'shared', SETTINGS_KEY, {});
    const next = { ...latest, version: 1, lists: { ...latest.lists, [listId]: rule } };
    if (JSON.stringify({ [SETTINGS_KEY]: next }).length > 3900) throw new Error('The Trello storage for this board is full.');
    await t.set('board', 'shared', SETTINGS_KEY, next);
    config = next;
    if (selected === listId) { dirty = false; $('form-message').textContent = 'Saved. Cards will refresh shortly.'; $('form-message').className = 'help success-text'; }
  } catch (error) { $('form-message').textContent = error.message || 'Could not save. Try again.'; $('form-message').className = 'error'; }
  finally {
    for (const control of $('settings-form').querySelectorAll('input, select, button')) control.disabled = !writable;
    $('unit').disabled = !writable;
    resize();
  }
});
$('open-auth').addEventListener('click', () => {
  if (demo) { location.href = './authorize.html?demo=1'; return; }
  Promise.resolve(t.popup({ title: 'Connect Productivity', url: './authorize.html?v=20260917-review', height: AUTH_POPUP_HEIGHT })).catch(() => {});
});
init().catch(() => { $('loading').hidden = false; $('loading').textContent = 'Settings could not be loaded. Open this view through Productivity in Trello.'; }).finally(ready);
