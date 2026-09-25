import { SETTINGS_KEY } from './domain.js?v=20260925-review2';
export function demoClient() {
  const store = new Map();
  try { store.set(SETTINGS_KEY, JSON.parse(localStorage.getItem('productivity-demo') || '{}')); } catch { /* A blocked demo store remains usable in memory. */ }
  return {
    lists: async () => [{ id: 'ideas', name: 'Ideas' }, { id: 'doing', name: 'In progress' }, { id: 'review', name: 'Review' }, { id: 'done', name: 'Done' }],
    get: async (_scope, _visibility, key, fallback) => store.get(key) ?? fallback,
    set: async (_scope, _visibility, key, value) => { store.set(key, value); if (key === SETTINGS_KEY) { try { localStorage.setItem('productivity-demo', JSON.stringify(value)); } catch { /* optional persistence */ } } },
    remove: async (_scope, _visibility, key) => store.delete(key),
    arg: () => 'doing', memberCanWriteToModel: () => true, sizeTo: async () => {},
  };
}
