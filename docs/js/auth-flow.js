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
    timer = timeout(() => finish(new Error('Die Anmeldung hat zu lange gedauert. Bitte erneut verbinden.')), timeoutMs);
    try {
      // Keep this synchronous with the user click so browsers allow the popup.
      const pending = t.authorize(url, {
        width: 600, height: 740,
        windowCallback(popup) {
          if (!popup) {
            finish(new Error('Das Anmeldefenster wurde blockiert. Bitte Pop-ups erlauben oder Trello in einem normalen Browser öffnen.'));
            return;
          }
          poll = interval(() => {
            if (popup.closed) finish(new Error('Das Anmeldefenster wurde geschlossen. Du kannst die Verbindung erneut starten.'));
          }, 500);
        },
      });
      Promise.resolve(pending).then(token => finish(null, token), () => finish(new Error('Die Trello-Freigabe wurde nicht abgeschlossen. Bitte erneut versuchen.')));
    } catch { finish(new Error('Das Anmeldefenster konnte nicht geöffnet werden. Bitte erneut versuchen.')); }
  });
}
