import test from 'node:test';
import assert from 'node:assert/strict';
import { popupLayout, SETTINGS_POPUP_HEIGHT } from '../docs/js/popup-layout.js';

function fixture(context) {
  let contentHeight = 100;
  let observeResize;
  const frames = [];
  const sizes = [];
  const app = { style: {}, getBoundingClientRect: () => ({ height: Math.max(contentHeight, parseFloat(app.style.minHeight) || 0) }) };
  function install(name, value) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    context.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }
  install('document', { getElementById: () => app, documentElement: { classList: { toggle() {} } } });
  install('ResizeObserver', class { constructor(callback) { observeResize = callback; } observe() { observeResize(); } });
  install('requestAnimationFrame', callback => frames.push(callback));
  const layout = popupLayout({ sizeTo: async height => { sizes.push(height); } }, false, SETTINGS_POPUP_HEIGHT);
  return {
    app, layout, sizes,
    render(height) { contentHeight = height; observeResize(); },
    flush() { while (frames.length) frames.shift()(); },
  };
}

test('opening keeps the reserved height through loading and the ready form', context => {
  const f = fixture(context);
  assert.equal(f.app.style.minHeight, `${SETTINGS_POPUP_HEIGHT}px`);
  f.render(100); f.flush();
  f.layout.resize(); f.flush();
  f.render(500); f.flush(); // Even a temporary wrapped message must not resize during loading.
  assert.deepEqual(f.sizes, []);
  f.render(SETTINGS_POPUP_HEIGHT);
  f.layout.ready(); f.flush();
  assert.deepEqual(f.sizes, [], 'the already-correct Trello frame needs no resize request');
});

test('after loading, expanded help fits and collapsing restores the opening height', context => {
  const f = fixture(context);
  f.render(SETTINGS_POPUP_HEIGHT); f.layout.ready(); f.flush();
  f.render(520.2); f.flush();
  f.render(SETTINGS_POPUP_HEIGHT); f.flush();
  assert.deepEqual(f.sizes, [521, SETTINGS_POPUP_HEIGHT]);
});

test('a taller final error or permission notice is sized once it is ready', context => {
  const f = fixture(context);
  f.render(470); f.flush();
  assert.deepEqual(f.sizes, []);
  f.layout.ready(); f.flush();
  f.render(470); f.flush();
  assert.deepEqual(f.sizes, [470]);
});
