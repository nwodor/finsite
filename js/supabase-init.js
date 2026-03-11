// initializing Supabase — reads config from window.FINSITE_SUPABASE_CONFIG set in config.local.js
// handles the client singleton, DB helpers for profiles and analyses

const FinSiteDB = (() => {

  let _client = null;

  function isConfigured() {
    const cfg = window.FINSITE_SUPABASE_CONFIG;
    if (!cfg) return false;
    if (!cfg.url     || cfg.url.includes('YOUR_'))     return false;
    if (!cfg.anonKey || cfg.anonKey.includes('YOUR_')) return false;
    return true;
  }

  function getClient() {
    if (_client) return _client;
    if (!isConfigured()) return null;
    const { url, anonKey } = window.FINSITE_SUPABASE_CONFIG;
    _client = window.supabase.createClient(url, anonKey);
    return _client;
  }

  // upserting the user's profile row in the profiles table
  async function saveUserProfile(uid, data) {
    const client = getClient();
    if (!client) return;
    try {
      const { error } = await client.from('profiles').upsert({
        id:         uid,
        name:       data.name    || '',
        email:      data.email   || '',
        avatar:     data.avatar  || null,
        provider:   data.provider || 'email',
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (err) {
      console.warn('Profile save failed:', err.message);
    }
  }

  // inserting a new analysis row under the user's id
  async function saveAnalysis(uid, result, fileName) {
    const client = getClient();
    if (!client || !uid) return null;
    try {
      const { data, error } = await client.from('analyses').insert({
        user_id:       uid,
        file_name:     fileName || 'statement',
        score:         result.score,
        grade:         result.grade,
        summary:       result.summary,
        health:        result.health,
        total_in:      result.totalIn,
        total_out:     result.totalOut,
        tx_count:      result.txCount,
        savings_rate:  result.savingsRate,
        top_categories: result.topCategories,
        monthly_trend:  result.monthlyTrend,
        wasteful:       result.wasteful,
        savings:        result.savings,
        investments:    result.investments,
        quick_wins:     result.quickWins,
      }).select('id').single();
      if (error) throw error;
      return data?.id || null;
    } catch (err) {
      console.warn('Analysis save failed:', err.message);
      return null;
    }
  }

  // pulling the last 10 analyses for this user, newest first
  async function loadAnalysisHistory(uid) {
    const client = getClient();
    if (!client || !uid) return [];
    try {
      const { data, error } = await client
        .from('analyses')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('History load failed:', err.message);
      return [];
    }
  }

  // mapping Supabase error messages to friendly UI strings
  function friendlyError(err) {
    const msg = err?.message || '';
    if (msg.includes('already registered') || msg.includes('already been registered'))
      return 'An account with that email already exists.';
    if (msg.includes('Invalid login credentials'))
      return 'Invalid email or password.';
    if (msg.includes('Email rate limit') || msg.includes('too many requests'))
      return 'Too many attempts. Please wait a moment and try again.';
    if (msg.includes('Password should be') || msg.includes('at least'))
      return 'Password must be at least 6 characters.';
    if (msg.includes('Unable to validate') || msg.includes('valid email'))
      return 'Invalid email address.';
    if (msg.includes('not configured'))
      return 'Supabase is not configured. Add FINSITE_SUPABASE_CONFIG to js/config.local.js.';
    if (msg.includes('Email not confirmed'))
      return 'Please confirm your email before signing in.';
    return msg || 'Something went wrong. Please try again.';
  }

  return { isConfigured, getClient, saveUserProfile, saveAnalysis, loadAnalysisHistory, friendlyError };

})();

window.FinSiteDB = FinSiteDB;
