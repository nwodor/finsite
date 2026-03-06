// i handle sign in and sign up here — Google OAuth and email/password
// i store sessions in localStorage for now — i'll swap saveSession() for a real backend call later

const AuthApp = (() => {

  let _mode = 'signin'; // 'signin' | 'signup'
  let _pwVisible = false;
  let _googleReady = false;

  // i pull the client ID from config.local.js if i've set it
  const GOOGLE_CLIENT_ID = (typeof window !== 'undefined' && window.FINSITE_GOOGLE_CLIENT_ID) || null;

  // ── Floating emoji background ─────────────────────────────────────────────

  const EMOJIS = ['💰','💳','📈','💵','💹','📊','💎','🪙','💸','🤑','🏦','💲','📉','🏧','💴','💶','💷','🤝','📋','🔐'];

  function spawnEmojis() {
    const field = document.getElementById('emoji-field');
    if (!field) return;

    // i spawn 18 emojis staggered across the full width
    for (let i = 0; i < 18; i++) {
      const el = document.createElement('span');
      el.className = 'float-emoji';
      el.textContent = EMOJIS[i % EMOJIS.length];

      const size   = 22 + Math.random() * 22;          // 22–44px
      const left   = 3 + Math.random() * 94;           // 3–97% across
      const dur    = 12 + Math.random() * 14;          // 12–26s
      const delay  = -(Math.random() * dur);            // i stagger the start so they're already mid-flight on load

      el.style.cssText = `
        font-size: ${size}px;
        left: ${left}%;
        animation-duration: ${dur}s;
        animation-delay: ${delay}s;
        opacity: 0;
      `;

      field.appendChild(el);
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  function init() {
    spawnEmojis();

    // i skip to the upload page if i'm already logged in
    if (getSession()) {
      window.location.replace('./index.html');
      return;
    }

    // i load Google Identity Services if i've configured a client ID
    if (GOOGLE_CLIENT_ID) {
      _loadGoogleScript();
    }

    // i set the client ID on the hidden onload div
    const onload = document.getElementById('g_id_onload');
    if (onload && GOOGLE_CLIENT_ID) {
      onload.setAttribute('data-client_id', GOOGLE_CLIENT_ID);
      onload.style.display = '';
    }

    setMode('signin');
  }

  // ── Mode toggle ───────────────────────────────────────────────────────────

  function setMode(mode) {
    _mode = mode;

    const nameField    = document.getElementById('field-name');
    const confirmField = document.getElementById('field-confirm');
    const forgotLink   = document.getElementById('forgot-link');
    const submitLabel  = document.getElementById('submit-label');
    const switchText   = document.getElementById('switch-text');
    const switchBtn    = document.getElementById('switch-btn');
    const tabSignin    = document.getElementById('tab-signin');
    const tabSignup    = document.getElementById('tab-signup');
    const indicator    = document.getElementById('tab-indicator');
    const pwInput      = document.getElementById('input-password');

    clearError();

    if (mode === 'signup') {
      nameField.style.display    = '';
      confirmField.style.display = '';
      forgotLink.style.display   = 'none';
      submitLabel.textContent    = 'Create Account';
      switchText.textContent     = 'Already have an account?';
      switchBtn.textContent      = 'Sign in';
      tabSignin.classList.remove('active');
      tabSignup.classList.add('active');
      indicator.classList.add('right');
      pwInput.setAttribute('autocomplete', 'new-password');

      // i retrigger the animation on the name field
      if (nameField) {
        nameField.style.animation = 'none';
        void nameField.offsetWidth;
        nameField.style.animation = '';
      }
    } else {
      nameField.style.display    = 'none';
      confirmField.style.display = 'none';
      forgotLink.style.display   = '';
      submitLabel.textContent    = 'Sign In';
      switchText.textContent     = "Don't have an account?";
      switchBtn.textContent      = 'Sign up';
      tabSignin.classList.add('active');
      tabSignup.classList.remove('active');
      indicator.classList.remove('right');
      pwInput.setAttribute('autocomplete', 'current-password');
    }
  }

  function toggleMode() {
    setMode(_mode === 'signin' ? 'signup' : 'signin');
  }

  // ── Password visibility ───────────────────────────────────────────────────

  function togglePassword() {
    _pwVisible = !_pwVisible;
    const input = document.getElementById('input-password');
    const icon  = document.getElementById('eye-icon');
    if (!input) return;

    input.type = _pwVisible ? 'text' : 'password';

    // i swap between the open and closed eye icon
    icon.innerHTML = _pwVisible
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>`
      : `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`;
  }

  // ── Form submission ───────────────────────────────────────────────────────

  function handleSubmit(e) {
    e.preventDefault();
    clearError();

    const email    = document.getElementById('input-email')?.value.trim() || '';
    const password = document.getElementById('input-password')?.value || '';
    const name     = document.getElementById('input-name')?.value.trim() || '';
    const confirm  = document.getElementById('input-confirm')?.value || '';

    // i validate before doing anything
    if (!_isValidEmail(email)) {
      showError('Please enter a valid email address.');
      document.getElementById('input-email')?.classList.add('error');
      return;
    }
    if (password.length < 8) {
      showError('Password must be at least 8 characters.');
      document.getElementById('input-password')?.classList.add('error');
      return;
    }
    if (_mode === 'signup') {
      if (!name) {
        showError('Please enter your full name.');
        document.getElementById('input-name')?.classList.add('error');
        return;
      }
      if (password !== confirm) {
        showError('Passwords do not match.');
        document.getElementById('input-confirm')?.classList.add('error');
        return;
      }
    }

    setLoading(true);

    // i fake a brief async delay here — i'll replace this with a real API call later
    setTimeout(() => {
      saveSession({
        name:     _mode === 'signup' ? name : (email.split('@')[0]),
        email,
        provider: 'email',
        avatar:   null,
      });
      redirect();
    }, 600);
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────

  function handleGoogleClick() {
    if (!GOOGLE_CLIENT_ID) {
      showError(
        'Google Sign-In is not configured. Add your Google Client ID to js/config.local.js:\n' +
        'window.FINSITE_GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com";'
      );
      return;
    }
    if (!_googleReady) {
      showError('Google Sign-In is still loading — please try again in a moment.');
      return;
    }
    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // i fall back to a popup if the prompt doesn't show
        google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'openid email profile',
          callback: () => {},
        }).requestAccessToken();
      }
    });
  }

  // i get called by Google Identity Services after the user signs in
  function handleGoogleCallback(response) {
    try {
      const payload = _parseJWT(response.credential);
      saveSession({
        name:     payload.name || payload.email,
        email:    payload.email,
        avatar:   payload.picture || null,
        provider: 'google',
      });
      redirect();
    } catch (err) {
      showError('Google sign-in failed. Please try again.');
      console.error('Google callback error:', err);
    }
  }

  function _loadGoogleScript() {
    if (document.getElementById('gsi-script')) return;
    const script = document.createElement('script');
    script.id  = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => { _googleReady = true; };
    document.head.appendChild(script);
  }

  // ── Forgot password ───────────────────────────────────────────────────────

  function handleForgot(e) {
    e.preventDefault();
    const email = document.getElementById('input-email')?.value.trim() || '';
    if (!email || !_isValidEmail(email)) {
      showError('Enter your email address above, then click "Forgot password?".');
      return;
    }
    // i'll hook this up to my backend's password reset endpoint later
    showError('Password reset is not yet configured. Contact the site admin.');
  }

  // ── Session ───────────────────────────────────────────────────────────────

  function saveSession(user) {
    localStorage.setItem('finsite_session', JSON.stringify({
      ...user,
      ts: Date.now(),
    }));
  }

  function getSession() {
    try {
      const raw = localStorage.getItem('finsite_session');
      if (!raw) return null;
      const session = JSON.parse(raw);
      // i expire sessions after 7 days
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - (session.ts || 0) > SEVEN_DAYS) {
        localStorage.removeItem('finsite_session');
        return null;
      }
      return session;
    } catch { return null; }
  }

  function redirect() {
    window.location.replace('./index.html');
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  function showError(msg) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    // i retrigger the animation
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    setLoading(false);
  }

  function clearError() {
    const el = document.getElementById('auth-error');
    if (el) el.style.display = 'none';
    document.querySelectorAll('.glass-input.error').forEach(i => i.classList.remove('error'));
  }

  function setLoading(on) {
    const btn     = document.getElementById('submit-btn');
    const label   = document.getElementById('submit-label');
    const spinner = document.getElementById('btn-spinner');
    if (!btn) return;
    btn.disabled = on;
    if (label)   label.style.display   = on ? 'none' : '';
    if (spinner) spinner.style.display = on ? '' : 'none';
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  function _isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function _parseJWT(token) {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  }

  // ── Expose ────────────────────────────────────────────────────────────────
  return {
    init,
    setMode,
    toggleMode,
    togglePassword,
    handleSubmit,
    handleGoogleClick,
    handleGoogleCallback,
    handleForgot,
    getSession,
  };

})();

// i expose AuthApp globally so Google's GSI callback can reach it
window.AuthApp = AuthApp;

document.addEventListener('DOMContentLoaded', () => AuthApp.init());
