import test from 'node:test';
import assert from 'node:assert/strict';
import { HOUR, DEFAULT_RULE, ruleFor, unitFor, parseThreshold, validateRule, statusFor, formatDuration, findListEntry, findBoardOrigin, listEntryState, badgeFor } from '../docs/js/domain.js';

const card = { id: 'card-1', idList: 'doing' };
const move = (id, date, from, to) => ({ id, type: 'updateCard', date, data: { card: { id: card.id }, listBefore: { id: from }, listAfter: { id: to } } });
test('colors begin exactly at each configured threshold', () => {
  assert.equal(statusFor(48 * HOUR - 1, DEFAULT_RULE), 'green');
  assert.equal(statusFor(48 * HOUR, DEFAULT_RULE), 'orange');
  assert.equal(statusFor(120 * HOUR - 1, DEFAULT_RULE), 'orange');
  assert.equal(statusFor(120 * HOUR, DEFAULT_RULE), 'red');
});
test('each phase has independent defaults and individually disabled colors', () => {
  const settings = { lists: { done: { orange: null, red: null }, doing: { orange: null, red: 5 } } };
  assert.deepEqual(ruleFor(settings, 'backlog'), DEFAULT_RULE);
  assert.equal(statusFor(500 * HOUR, ruleFor(settings, 'done')), 'normal');
  assert.equal(statusFor(5 * HOUR, ruleFor(settings, 'doing')), 'red');
  assert.equal(statusFor(5 * HOUR, { orange: 1, red: null }), 'orange');
});
test('units, decimal values, zero and disabled thresholds', () => {
  assert.equal(parseThreshold('1,5', 'days'), 36);
  assert.equal(parseThreshold('0.5', 'hours'), .5);
  assert.equal(parseThreshold('0'), 0);
  assert.equal(parseThreshold(' '), null);
  for (const input of ['-1', 'Infinity', 'NaN', 'abc', '876001']) assert.throws(() => parseThreshold(input));
  assert.throws(() => validateRule({ orange: 2, red: 2 }));
  assert.throws(() => validateRule({ orange: 3, red: 2 }));
  assert.deepEqual(validateRule({ orange: null, red: 0 }), { orange: null, red: 0 });
});
test('legacy hour thresholds reopen in readable units without changing timing', () => {
  const settings = { lists: { short: { orange: 0, red: 1 }, fraction: { orange: null, red: 0.01 }, off: { orange: null, red: null } } };
  assert.equal(unitFor(settings, 'short'), 'hours');
  assert.equal(unitFor(settings, 'fraction'), 'hours');
  assert.equal(unitFor(settings, 'off'), 'days');
  assert.equal(unitFor(settings, 'new'), 'days');
  assert.deepEqual(ruleFor(settings, 'short'), { green: null, orange: 0, red: 1 });
});
test('saved unit preferences remain per phase and do not change badge thresholds', () => {
  const settings = { lists: { a: { orange: 24, red: 48, unit: 'hours' }, b: { orange: 12, red: 36, unit: 'days' }, c: { orange: 1, red: 2, unit: 'unknown' } } };
  assert.equal(unitFor(settings, 'a'), 'hours');
  assert.equal(unitFor(settings, 'b'), 'days');
  assert.equal(unitFor(settings, 'c'), 'hours');
  assert.equal(statusFor(36 * HOUR, ruleFor(settings, 'b')), 'red');
});
test('readable elapsed time has stable minute/hour/day boundaries', () => {
  assert.equal(formatDuration(-100), '< 1 min');
  assert.equal(formatDuration(59_999), '< 1 min');
  assert.equal(formatDuration(60_000), '1 min');
  assert.equal(formatDuration(HOUR), '1 hr 0 min');
  assert.equal(formatDuration(25 * HOUR), '1 d 1 hr');
});
test('most recent entry wins, including leaving and returning to the same phase', () => {
  const actions = [move('a', '2026-09-01T08:00:00Z', 'ideas', 'doing'), move('c', '2026-09-05T09:00:00Z', 'review', 'doing'), move('b', '2026-09-04T08:00:00Z', 'doing', 'review')];
  assert.equal(findListEntry(actions, card).actionId, 'c');
});
test('comments, renames and within-list reordering do not reset time', () => {
  const entry = move('a', '2026-09-01T08:00:00Z', 'ideas', 'doing');
  const actions = [entry, { type: 'commentCard', date: '2026-09-03T12:00:00Z', data: {} }, { type: 'updateCard', date: '2026-09-04T12:00:00Z', data: { old: { pos: 1 } } }, move('z', '2026-09-05T12:00:00Z', 'doing', 'doing')];
  assert.equal(findListEntry(actions, card).actionId, 'a');
});
test('new, copied, emailed and converted cards use their recorded creation', () => {
  for (const type of ['createCard', 'copyCard', 'emailCard', 'convertToCardFromCheckItem', 'moveCardToBoard']) {
    const entry = findListEntry([{ id: type, type, date: '2026-09-01T08:00:00Z', data: { card: { id: card.id }, list: { id: card.idList } } }], card);
    assert.equal(entry.source, type);
  }
});
test('incomplete or temporarily mismatched histories never claim an older start', () => {
  assert.equal(findListEntry([], card), null);
  assert.equal(findListEntry([move('a', 'invalid', 'ideas', 'doing')], card), null);
  const actions = [move('a', '2026-09-01T08:00:00Z', 'ideas', 'doing'), move('b', '2026-09-03T08:00:00Z', 'doing', 'review')];
  assert.equal(findListEntry(actions, card), null);
  assert.equal(findListEntry([{ id: 'board-move', type: 'moveCardToBoard', date: '2026-09-05T00:00:00Z', data: {} }, ...actions], card), null);
  assert.equal(badgeFor(null, DEFAULT_RULE).text, 'Move card to start timer');
});

test('board actions recover origins that card-nested actions omit', () => {
  const created = { id: 'created', type: 'createCard', date: '2026-09-01T08:00:00Z', data: { card: { id: card.id }, list: { id: card.idList } } };
  assert.equal(findBoardOrigin([created], card).actionId, 'created');
  const copiedBoard = { id: 'board-copy', type: 'copyBoard', date: '2026-08-01T08:00:00Z', data: {} };
  assert.equal(findBoardOrigin([copiedBoard], card).source, 'copyBoard');
  assert.deepEqual(listEntryState([{ ...created, data: { ...created.data, card: { id: 'other' } } }], card), { recorded: false, entry: null });
});
test('the same timestamp uses the latest action ID and ignores another card', () => {
  const actions = [move('b', '2026-09-01T08:00:00Z', 'review', 'doing'), move('a', '2026-09-01T08:00:00Z', 'doing', 'review'), { ...move('c', '2026-09-02T08:00:00Z', 'doing', 'review'), data: { card: { id: 'other' }, listAfter: { id: 'review' } } }];
  assert.equal(findListEntry(actions, card).actionId, 'b');
});
test('calendar time continues while closed, including weekends and DST changes', () => {
  const entry = { enteredAt: Date.parse('2026-03-28T12:00:00+01:00') };
  assert.equal(badgeFor(entry, DEFAULT_RULE, Date.parse('2026-03-29T12:00:00+02:00')).text, '23 hr 0 min');
  assert.equal(badgeFor(entry, DEFAULT_RULE, entry.enteredAt + 149 * HOUR).color, 'red');
});

test('green is an independent inclusive threshold with orange and red taking precedence', () => {
  const rule = { green: 2, orange: 4, red: 6 };
  assert.equal(statusFor(2 * HOUR - 1, rule), 'normal');
  assert.equal(statusFor(2 * HOUR, rule), 'green');
  assert.equal(statusFor(4 * HOUR, rule), 'orange');
  assert.equal(statusFor(6 * HOUR, rule), 'red');
  assert.equal(badgeFor({ enteredAt: 0 }, rule, 3 * HOUR).color, 'green');
  assert.equal(badgeFor(null, rule, 3 * HOUR).color, 'light-gray');
});

test('each color can be disabled without bypassing the order of remaining thresholds', () => {
  assert.equal(statusFor(3 * HOUR, { green: null, orange: 4, red: 6 }), 'normal');
  assert.equal(statusFor(5 * HOUR, { green: 2, orange: null, red: 6 }), 'green');
  assert.equal(statusFor(9 * HOUR, { green: 2, orange: 4, red: null }), 'orange');
  assert.equal(statusFor(9 * HOUR, { green: null, orange: null, red: null }), 'normal');
  for (const rule of [
    { green: 2, orange: 2, red: 6 },
    { green: 4, orange: 2, red: null },
    { green: 5, orange: null, red: 3 },
    { green: 3, orange: null, red: 3 },
    { green: -1, orange: 4, red: 6 },
    { green: Infinity, orange: null, red: null },
  ]) assert.throws(() => validateRule(rule));
  assert.deepEqual(validateRule({ green: 0, orange: null, red: null }), { green: 0, orange: null, red: null });
});

test('green settings remain isolated per phase and legacy disabled colors stay disabled', () => {
  const settings = { lists: { first: { green: 0, orange: 5, red: 10 }, second: { green: 2, orange: null, red: null }, legacy: { orange: null, red: null } } };
  assert.equal(statusFor(HOUR, ruleFor(settings, 'first')), 'green');
  assert.equal(statusFor(HOUR, ruleFor(settings, 'second')), 'normal');
  assert.deepEqual(ruleFor(settings, 'legacy'), { green: null, orange: null, red: null });
  assert.equal(statusFor(HOUR, ruleFor(settings, 'new')), 'green');
  assert.equal(unitFor({ lists: { list: { green: 0.5, orange: 24, red: 48 } } }, 'list'), 'hours');
});
