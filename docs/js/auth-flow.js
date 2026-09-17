// Trello's helper does not reject when a browser blocks or closes its popup.
export function authorizeWithPopup(t, url, {
  timeoutMs = 300_000,
  interval = globalThis.setInterval,
  clearInterval = globalThis.clearInterval,
  timeout = globalThis.setTimeout,
  clearTimeout = globalThis.clearTimeout,
} = {}) {
  return new Promise((resolve, reject) => {
    let poll;
    let timer;
    let finished = false;
    const finish = (error, token) => {
      if (finished) return;
      finished = true;
      clearInterval(poll); clearTimeout(timer);
      if (error) reject(error); else resolve(token);
    };
    timer = timeout(() => finish(new Error('Authorization took too long. Try connecting again.')), timeoutMs);
    try {
      // Keep this synchronous with the user click so browsers allow the popup.
      const pending = t.authorize(url, {
        width: 600, height: 740,
        windowCallback(popup) {
          if (!popup) {
            finish(new Error('The authorization window was blocked. Allow pop-ups or open Trello in a regular browser.'));
            return;
          }
          poll = interval(() => {
            if (popup.closed) finish(new Error('The authorization window was closed. You can start the connection again.'));
          }, 500);
        },
      });
      Promise.resolve(pending).then(token => finish(null, token), () => finish(new Error('Trello authorization was not completed. Try again.')));
    } catch { finish(new Error('The authorization window could not be opened. Try again.')); }
  });
}
