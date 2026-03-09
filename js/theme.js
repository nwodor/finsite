// applying theme immediately before first paint — prevents any flash of wrong colors
(function () {
  const stored = localStorage.getItem('finsite_theme');
  const preferred = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', preferred);
}());

const FinSiteTheme = (() => {

  function current() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('finsite_theme', theme);
    _syncButtons(theme);
  }

  function toggle() {
    apply(current() === 'dark' ? 'light' : 'dark');
  }

  // syncing all toggle buttons on the page to show the right icon
  function _syncButtons(theme) {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.textContent    = theme === 'dark' ? '☀️' : '🌙';
      btn.title          = theme === 'dark' ? 'Light mode' : 'Dark mode';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  function init() {
    _syncButtons(current());
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', toggle);
    });
  }

  return { init, toggle, apply, current };
})();

window.FinSiteTheme = FinSiteTheme;
document.addEventListener('DOMContentLoaded', () => FinSiteTheme.init());
