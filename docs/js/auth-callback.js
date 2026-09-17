(() => {
  const token = new URLSearchParams(location.hash.slice(1)).get('token');
  history.replaceState(null, '', location.pathname);
  const message = document.getElementById('message');
  if (!token) { message.textContent = 'No authorization received. Start the connection again in Trello.'; return; }
  try {
    // Same-origin access is enforced by the browser. No token in localStorage.
    if (!window.opener || typeof window.opener.authorize !== 'function') throw new Error('No opener');
    window.opener.authorize(token);
    message.textContent = 'Connected. You can close this window.';
    window.close();
  } catch {
    message.textContent = 'The Trello window connection is missing. Close this window and try again with pop-ups enabled.';
  }
})();
