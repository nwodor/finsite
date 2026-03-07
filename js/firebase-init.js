// initializing Firebase — reading config from window.FINSITE_FIREBASE_CONFIG set in config.local.js
// Firebase handles all auth (email/password + Google) and Firestore stores user profiles + analysis history

const FinSiteFirebase = (() => {

  let _initialized = false;

  function isConfigured() {
    const cfg = typeof window !== 'undefined' && window.FINSITE_FIREBASE_CONFIG;
    if (!cfg) return false;
    // detecting placeholder values — not truly configured if key still contains 'YOUR_'
    if (!cfg.apiKey || cfg.apiKey.includes('YOUR_')) return false;
    if (!cfg.projectId || cfg.projectId.includes('YOUR_')) return false;
    return true;
  }

  function initFirebase() {
    if (_initialized) return true;
    if (!isConfigured()) return false;

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(window.FINSITE_FIREBASE_CONFIG);
      }
      _initialized = true;
      return true;
    } catch (err) {
      console.error('Firebase init failed:', err);
      return false;
    }
  }

  function getAuth() {
    return _initialized ? firebase.auth() : null;
  }

  function getFirestore() {
    if (!_initialized) return null;
    try { return firebase.firestore(); } catch { return null; }
  }

  // saving user profile to Firestore on sign-up or first Google login
  async function saveUserProfile(uid, data) {
    const db = getFirestore();
    if (!db) return;
    try {
      await db.collection('users').doc(uid).set({
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore profile save failed:', err);
    }
  }

  // saving an analysis result to Firestore under the user's subcollection
  async function saveAnalysis(uid, result, fileName) {
    const db = getFirestore();
    if (!db || !uid) return null;
    try {
      const ref = await db.collection('users').doc(uid).collection('analyses').add({
        ...result,
        fileName: fileName || 'statement',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
      return ref.id;
    } catch (err) {
      console.warn('Firestore analysis save failed:', err);
      return null;
    }
  }

  // loading the user's analysis history from Firestore
  async function loadAnalysisHistory(uid) {
    const db = getFirestore();
    if (!db || !uid) return [];
    try {
      const snap = await db.collection('users').doc(uid).collection('analyses')
        .orderBy('createdAt', 'desc').limit(10).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn('Firestore history load failed:', err);
      return [];
    }
  }

  // mapping Firebase error codes to friendly messages
  function friendlyError(err) {
    const map = {
      'auth/email-already-in-use':    'An account with that email already exists.',
      'auth/invalid-email':           'Invalid email address.',
      'auth/weak-password':           'Password must be at least 6 characters.',
      'auth/user-not-found':          'Invalid email or password.',
      'auth/wrong-password':          'Invalid email or password.',
      'auth/invalid-credential':      'Invalid email or password.',
      'auth/too-many-requests':       'Too many attempts. Please wait a moment and try again.',
      'auth/popup-closed-by-user':    'Sign-in popup was closed.',
      'auth/network-request-failed':  'Network error. Check your connection.',
      'auth/user-disabled':           'This account has been disabled.',
      'auth/operation-not-allowed':   'This sign-in method is not enabled. Check your Firebase console.',
      'auth/internal-error':          'Firebase internal error — make sure Google sign-in is enabled in your Firebase console under Authentication → Sign-in method.',
    };
    return map[err?.code] || err?.message || 'Something went wrong. Please try again.';
  }

  return { isConfigured, initFirebase, getAuth, getFirestore, saveUserProfile, saveAnalysis, loadAnalysisHistory, friendlyError };

})();

window.FinSiteFirebase = FinSiteFirebase;
