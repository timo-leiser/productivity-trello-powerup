import { HOUR, formatDuration, ruleFor, statusFor } from './domain.js';
const dialog = document.getElementById('settings-dialog');
function render() {
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem('productivity-demo') || '{}'); } catch { /* Defaults when storage is blocked. */ }
  for (const badge of document.querySelectorAll('[data-hours]')) {
    const elapsed = Number(badge.dataset.hours) * HOUR;
    badge.textContent = formatDuration(elapsed);
    const state = statusFor(elapsed, ruleFor(settings, badge.dataset.list));
    badge.className = `badge ${state}`;
    badge.setAttribute('aria-label', `${formatDuration(elapsed)} in dieser Phase · ${state === 'red' ? 'Aufmerksamkeit' : state === 'orange' ? 'Nachfassen' : 'Im Zeitrahmen'}`);
  }
}
document.getElementById('demo-settings').addEventListener('click', () => dialog.showModal());
document.getElementById('close-demo').addEventListener('click', () => { dialog.close(); render(); });
dialog.addEventListener('close', render);
window.addEventListener('storage', render);
document.getElementById('copy-url').addEventListener('click', async event => {
  try { await navigator.clipboard.writeText(document.getElementById('connector-url').value); event.target.textContent = 'Kopiert'; }
  catch { document.getElementById('connector-url').select(); event.target.textContent = 'Strg+C'; }
});
render();
