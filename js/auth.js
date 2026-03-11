// handling sign in and sign up here — Supabase Auth for email/password and Google OAuth
// Supabase manages sessions; localStorage is used as a fast client-side cache for the guard

const AuthApp = (() => {

  let _mode = 'signin'; // 'signin' | 'signup'
  let _pwVisible = false;

  // ── Floating emoji background ─────────────────────────────────────────────

  const NOTO_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest';
  const EMOJI_CODEPOINTS = [
    '1f4b0', // 💰 money bag
    '1f4b3', // 💳 credit card
    '1f4c8', // 📈 chart up
    '1f4b5', // 💵 dollar bill
    '1f4ca', // 📊 bar chart
    '1f48e', // 💎 gem
    '1fa99', // 🪙 coin
    '1f4b8', // 💸 money wings
    '1f911', // 🤑 money face
    '1f3e6', // 🏦 bank
    '1f4c9', // 📉 chart down
    '1f4bc', // 💼 briefcase
    '1f3c6', // 🏆 trophy
    '1f3af', // 🎯 bullseye
    '1f510', // 🔐 locked key
    '1f91d', // 🤝 handshake
    '1f4b9', // 💹 chart yen
    '1f4b2', // 💲 dollar sign
    '1f4cb', // 📋 clipboard
    '1f3e7', // 🏧 ATM
  ];

  const ANIMATIONS = ['emojiRise', 'emojiDrift', 'emojiSway', 'emojiBounce'];

  const EASINGS = {
    emojiRise:   'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    emojiDrift:  'cubic-bezier(0.42, 0, 0.58, 1)',
    emojiSway:   'cubic-bezier(0.34, 1.3, 0.64, 1)',
    emojiBounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  };

  function spawnEmojis() {
    const field = document.getElementById('emoji-field');
    if (!field) return;

    // i shuffle the list so the layout is different every load
    const shuffled = [...EMOJI_CODEPOINTS].sort(() => Math.random() - 0.5);

    for (let i = 0; i < 22; i++) {
      const cp   = shuffled[i % shuffled.length];
      const anim = ANIMATIONS[Math.floor(Math.random() * ANIMATIONS.length)];
      const size = 52 + Math.random() * 44;
      const left = 2  + Math.random() * 96;
      const dur  = 14 + Math.random() * 16;
      const delay = -(Math.random() * dur);

      const img = document.createElement('img');
      img.className = 'float-emoji';
      img.src = `${NOTO_BASE}/${cp}/512.webp`;
      img.alt = '';
      img.draggable = false;
      img.onerror = () => { img.style.display = 'none'; };

      img.style.cssText = `
        width: ${size}px;
        height: ${size}px;
        left: ${left}%;
        animation-name: ${anim};
        animation-duration: ${dur}s;
        animation-delay: ${delay}s;
        animation-timing-function: ${EASINGS[anim]};
        animation-iteration-count: infinite;
        opacity: 0;
      `;

      field.appendChild(img);
    }
  }

  // ── Boot ──────────────────────────────────────────────────────────────────

  async function init() {
    spawnEmojis();

    // fast path — if the local session cache is still valid, skip to the app
    if (getSession()) {
      window.location.replace('./app.html');
      return;
    }

    if (!FinSiteDB.isConfigured()) {
      showError('Supabase is not configured. Add your credentials to js/config.local.js.');
      setMode('signin');
      bindListeners();
      return;
    }

    const client = FinSiteDB.getClient();

    // checking for an existing Supabase session — catches OAuth redirects too
    const { data: { session } } = await client.auth.getSession();
    if (session?.user) {
      await _onSignedIn(session.user);
      return;
    }

    setMode('signin');
    bindListeners();

    // listening for future auth events — e.g. OAuth redirect completing after form render
    client.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await _onSignedIn(session.user);
      }
    });
  }

  // called once we have a confirmed Supabase user — saves profile + session then redirects
  async function _onSignedIn(user) {
    const provider = user.app_metadata?.provider || 'email';
    const name     = user.user_metadata?.full_name
                  || user.user_metadata?.name
                  || user.email?.split('@')[0]
                  || 'User';
    const avatar   = user.user_metadata?.avatar_url || null;

    await FinSiteDB.saveUserProfile(user.id, { name, email: user.email, avatar, provider });

    saveSession({ uid: user.id, name, email: user.email, provider, avatar });
    redirect();
  }

  function bindListeners() {
    document.getElementById('tab-signin')?.addEventListener('click', () => setMode('signin'));
    document.getElementById('tab-signup')?.addEventListener('click', () => setMode('signup'));
    document.getElementById('google-btn')?.addEventListener('click', handleGoogleClick);
    document.getElementById('auth-form')?.addEventListener('submit', handleSubmit);
    document.getElementById('forgot-link')?.addEventListener('click', handleForgot);
    document.getElementById('toggle-pw')?.addEventListener('click', togglePassword);
    document.getElementById('switch-btn')?.addEventListener('click', toggleMode);
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

    icon.innerHTML = _pwVisible
      ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>`
      : `<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>`;
  }

  // ── Form submission ───────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault();
    clearError();

    const email    = document.getElementById('input-email')?.value.trim() || '';
    const password = document.getElementById('input-password')?.value || '';
    const name     = document.getElementById('input-name')?.value.trim() || '';
    const confirm  = document.getElementById('input-confirm')?.value || '';

    // client-side validation before hitting Supabase
    if (!_isValidEmail(email)) {
      showError('Please enter a valid email address.');
      document.getElementById('input-email')?.classList.add('error');
      return;
    }
    if (password.length < 6) {
      showError('Password must be at least 6 characters.');
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

    if (!FinSiteDB.isConfigured()) {
      showError('Supabase is not configured. Add your credentials to js/config.local.js.');
      return;
    }

    const client = FinSiteDB.getClient();
    setLoading(true);

    try {
      if (_mode === 'signup') {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { full_name: name } },
        });
        if (error) throw error;

        // if email confirmation is required, Supabase returns user but no session
        if (data.user && !data.session) {
          setLoading(false);
          showError('Account created! Check your email to confirm before signing in.');
          return;
        }
        if (data.session?.user) {
          await _onSignedIn(data.session.user);
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await _onSignedIn(data.user);
      }
    } catch (err) {
      showError(FinSiteDB.friendlyError(err));
    }
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────

  // triggering a Supabase OAuth redirect — Google auth happens on Google's page then
  // redirects back here, where onAuthStateChange or getSession picks it up
  async function handleGoogleClick() {
    if (!FinSiteDB.isConfigured()) {
      showError('Supabase is not configured. Add your credentials to js/config.local.js.');
      return;
    }

    const btn = document.getElementById('google-btn');
    if (btn) { btn.disabled = true; btn.style.opacity = '0.7'; }

    try {
      const client = FinSiteDB.getClient();
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // i redirect back to this exact page so onAuthStateChange can finish sign-in
          redirectTo: window.location.href,
        },
      });
      if (error) throw error;
      // browser navigates away here — no further JS runs until redirect back
    } catch (err) {
      if (btn) { btn.disabled = false; btn.style.opacity = ''; }
      showError(FinSiteDB.friendlyError(err));
    }
  }

  // ── Forgot password ───────────────────────────────────────────────────────

  async function handleForgot(e) {
    e.preventDefault();
    const email = document.getElementById('input-email')?.value.trim() || '';
    if (!email || !_isValidEmail(email)) {
      showError('Enter your email address above, then click "Forgot password?".');
      return;
    }

    if (!FinSiteDB.isConfigured()) {
      showError('Password reset requires Supabase. Add your credentials to js/config.local.js.');
      return;
    }

    try {
      const client = FinSiteDB.getClient();
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/finsite/auth.html',
      });
      if (error) throw error;
      showError('Password reset email sent — check your inbox.');
    } catch (err) {
      showError(FinSiteDB.friendlyError(err));
    }
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
      // i expire the cache after 7 days — Supabase has its own token refresh but
      // this catches stale caches from old sessions
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - (session.ts || 0) > SEVEN_DAYS) {
        localStorage.removeItem('finsite_session');
        return null;
      }
      return session;
    } catch { return null; }
  }

  function redirect() {
    window.location.replace('./app.html');
  }

  // signing out of Supabase and clearing the local session cache
  async function logout() {
    try {
      if (FinSiteDB.isConfigured()) {
        await FinSiteDB.getClient().auth.signOut();
      }
    } catch (_) {}
    localStorage.removeItem('finsite_session');
    window.location.replace('./auth.html');
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  function showError(msg) {
    const el = document.getElementById('auth-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
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

  // ── Expose ────────────────────────────────────────────────────────────────
  return {
    init,
    setMode,
    toggleMode,
    togglePassword,
    handleSubmit,
    handleGoogleClick,
    handleForgot,
    getSession,
    logout,
  };

})();

window.AuthApp = AuthApp;

document.addEventListener('DOMContentLoaded', () => AuthApp.init());
