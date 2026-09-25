import { HOUR, formatDuration, ruleFor, statusFor } from './domain.js?v=20260925-review2';
const dialog = document.getElementById('settings-dialog');
function render() {
  let settings = {};
  try { settings = JSON.parse(localStorage.getItem('productivity-demo') || '{}'); } catch { /* Defaults when storage is blocked. */ }
  for (const badge of document.querySelectorAll('[data-hours]')) {
    const elapsed = Number(badge.dataset.hours) * HOUR;
    badge.textContent = formatDuration(elapsed);
    const state = statusFor(elapsed, ruleFor(settings, badge.dataset.list));
    badge.className = `badge ${state}`;
    badge.setAttribute('aria-label', `${formatDuration(elapsed)} in this phase · ${state === 'red' ? 'Needs attention' : state === 'orange' ? 'Follow up' : 'On track'}`);
  }
}
document.getElementById('demo-settings').addEventListener('click', () => dialog.showModal());
document.getElementById('close-demo').addEventListener('click', () => { dialog.close(); render(); });
dialog.addEventListener('close', render);
window.addEventListener('storage', render);
render();
