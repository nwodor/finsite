// auth guard — redirecting to login if there's no valid session
(function () {
  try {
    var raw = localStorage.getItem('finsite_session');
    if (!raw) { window.location.replace('./auth.html'); return; }
    var s = JSON.parse(raw);
    // requiring uid — sessions from old fake auth won't have it
    if (!s.uid) {
      localStorage.removeItem('finsite_session');
      window.location.replace('./auth.html');
      return;
    }
    var SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - (s.ts || 0) > SEVEN_DAYS) {
      localStorage.removeItem('finsite_session');
      window.location.replace('./auth.html');
    }
  } catch (e) { window.location.replace('./auth.html'); }
})();
