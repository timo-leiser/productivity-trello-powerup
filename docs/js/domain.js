export const HOUR = 3_600_000;
export const SETTINGS_KEY = 'productivity-v1';
export const AUTH_KEY = 'productivity-auth-v1';
export const DEFAULT_RULE = Object.freeze({ green: 0, orange: 48, red: 120 });

export function ruleFor(settings, listId) {
  const rule = settings?.lists?.[listId] ?? DEFAULT_RULE;
  // Existing lists keep green disabled until explicitly configured.
  return { green: validHours(rule.green), orange: validHours(rule.orange), red: validHours(rule.red) };
}

export function unitFor(settings, listId) {
  const saved = settings?.lists?.[listId]?.unit;
  if (saved === 'hours' || saved === 'days') return saved;
  // Older settings store hours only. Avoid reopening an hour as 0.041666... days.
  const rule = ruleFor(settings, listId);
  return Object.values(rule).some(value => value !== null && value % 24 !== 0) ? 'hours' : 'days';
}

function validHours(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseThreshold(value, unit = 'hours') {
  if (String(value).trim() === '') return null;
  const number = Number(String(value).replace(',', '.'));
  const hours = number * (unit === 'days' ? 24 : 1);
  if (!Number.isFinite(hours) || hours < 0 || hours > 876_000) {
    throw new Error('Enter a time between 0 and 876,000 hours.');
  }
  return hours;
}

export function validateRule(rule) {
  for (const value of [rule.green ?? null, rule.orange, rule.red]) {
    if (value !== null && validHours(value) === null) throw new Error('Enter valid times.');
  }
  if (rule.orange !== null && rule.red !== null && rule.red <= rule.orange) {
    throw new Error('Red must start after orange.');
  }
  if (rule.green != null && rule.orange !== null && rule.orange <= rule.green) {
    throw new Error('Orange must start after green.');
  }
  if (rule.green != null && rule.red !== null && rule.red <= rule.green) {
    throw new Error('Red must start after green.');
  }
  return rule;
}

export function statusFor(elapsedMs, rule) {
  if (rule.red !== null && elapsedMs >= rule.red * HOUR) return 'red';
  if (rule.orange !== null && elapsedMs >= rule.orange * HOUR) return 'orange';
  if (rule.green != null && elapsedMs >= rule.green * HOUR) return 'green';
  return 'normal';
}

export function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} hr`;
}

// Only a recorded entry into the current list is proof of its start time.
// Never substitute dateLastActivity, install time or the card's object-id timestamp.
export function findListEntry(actions, card) {
  const sorted = [...actions].filter(a => Number.isFinite(Date.parse(a.date)))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date) || (b.id ?? '').localeCompare(a.id ?? ''));
  for (const action of sorted) {
    const data = action.data ?? {};
    if (data.card?.id && data.card.id !== card.id) continue;
    const isMove = action.type === 'updateCard' && data.listAfter?.id && data.listBefore?.id !== data.listAfter.id;
    const isOrigin = ['createCard', 'copyCard', 'convertToCardFromCheckItem', 'emailCard', 'moveCardToBoard'].includes(action.type);
    if (!isMove && !isOrigin) continue;
    const listId = isMove ? data.listAfter.id : data.list?.id ?? data.card?.idList;
    // Stop at the most recent transition, even if the API/UI are briefly out of sync.
    if (listId !== card.idList) return null;
    return { enteredAt: Date.parse(action.date), actionId: action.id, source: action.type };
  }
  return null;
}

export function badgeFor(entry, rule, now = Date.now()) {
  if (!entry) return { text: 'Phase time unknown', color: 'light-gray' };
  const elapsed = Math.max(0, now - entry.enteredAt);
  const status = statusFor(elapsed, rule);
  return { text: formatDuration(elapsed), color: status === 'normal' ? 'light-gray' : status };
}
