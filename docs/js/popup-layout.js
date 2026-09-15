// Shared by the opener and its iframe so the loading and ready states match.
export const SETTINGS_POPUP_HEIGHT = 375;
export const AUTH_POPUP_HEIGHT = 359;

// Measure the padded content box, not a child with uncounted body margins.
// Trello's outer popover owns scrolling when the available screen is shorter.
export function popupLayout(t, demo = false, initialHeight = 0) {
  const app = document.getElementById('app');
  document.documentElement.classList.toggle('trello-popup', !demo);
  app.style.minHeight = `${initialHeight}px`;
  let loaded = false;
  let pending = false;
  let previousHeight = initialHeight;
  const resize = () => {
    if (demo || !loaded || pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const height = Math.ceil(app.getBoundingClientRect().height);
      if (height <= 0 || height === previousHeight) return;
      previousHeight = height;
      t.sizeTo(height).catch(() => { previousHeight = 0; });
    });
  };
  new ResizeObserver(resize).observe(app);
  return { resize, ready() { loaded = true; resize(); } };
}
