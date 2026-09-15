(() => {
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  history.replaceState(null, '', location.pathname);
  const message = document.getElementById('message');
  if (!token) { message.textContent = 'Keine Freigabe erhalten. Bitte starte die Verbindung erneut in Trello.'; return; }
  try {
    // Same-origin access is enforced by the browser. No token in localStorage.
    if (!window.opener || typeof window.opener.authorize !== 'function') throw new Error('No opener');
    window.opener.authorize(token);
    message.textContent = 'Verbunden. Du kannst dieses Fenster schließen.';
    window.close();
  } catch {
    message.textContent = 'Die Verbindung zum Trello-Fenster fehlt. Schließe dieses Fenster und starte die Verbindung erneut mit erlaubten Pop-ups.';
  }
})();
