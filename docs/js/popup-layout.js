// Measure the padded content box, not a child with uncounted body margins.
// Trello's outer popover owns scrolling when the available screen is shorter.
export function popupLayout(t, demo = false) {
  const app = document.getElementById('app');
  document.documentElement.classList.toggle('trello-popup', !demo);
  let pending = false;
  let previousHeight = 0;
  const resize = () => {
    if (demo || pending) return;
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
  resize();
  return resize;
}
