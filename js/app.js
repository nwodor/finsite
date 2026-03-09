// controlling all the app state here and rendering the results dashboard

const FinSiteApp = (() => {

  let _data       = null;
  let _activePage = 'dashboard';

  const NAV_ITEMS = [
    { id: 'dashboard',     icon: 'bi-grid-1x2-fill',      label: 'Dashboard'       },
    { id: 'budget',        icon: 'bi-bar-chart-fill',      label: 'Budget'          },
    { id: 'subscriptions', icon: 'bi-arrow-repeat',        label: 'Subscriptions'   },
    { id: 'transactions',  icon: 'bi-credit-card-2-front', label: 'Transactions'    },
    { id: 'advice',        icon: 'bi-lightbulb-fill',      label: 'Financial Advice'},
    { id: 'savings',       icon: 'bi-piggy-bank-fill',     label: 'Savings'         },
    { id: 'accounts',      icon: 'bi-wallet2',             label: 'Accounts'        },
  ];

  // ── formatting helpers ──────────────────────────────────────────────────────

  const fmt = (n) => {
    if (n === undefined || n === null) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
  };

  const fmtShort = (n) => {
    if (!n && n !== 0) return '—';
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return fmt(n);
  };

  const escape = (s) => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

  function scoreColor(s) {
    if (s >= 80) return '#0da354';
    if (s >= 60) return '#16c165';
    if (s >= 40) return '#f59e0b';
    return '#f04040';
  }

  // shared glass card class string — using Tailwind utilities
  const GC  = `bg-white/70 backdrop-blur-xl border border-white/90 rounded-2xl shadow-glass transition-all duration-200 hover:shadow-lg hover:border-green-200/60`;
  const GCD = `bg-gray-950/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg`;

  // ── upload page ─────────────────────────────────────────────────────────────

  function init() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const keySection = document.getElementById('api-key-section');
    if (keySection) keySection.style.display = 'none';

    function checkReady() {
      if (analyzeBtn) analyzeBtn.disabled = !FinSiteUpload.getCurrentFile();
    }
    FinSiteUpload.init('upload-zone', () => checkReady());
    if (analyzeBtn) analyzeBtn.addEventListener('click', startAnalysis);
  }

  // ── analysis flow ───────────────────────────────────────────────────────────

  async function startAnalysis() {
    const file = FinSiteUpload.getCurrentFile();
    if (!file) return;
    showLoadingScreen();
    try {
      updateProgress(20, 'Reading your bank statement…');
      const csvText = await FinSiteUpload.readFile(file);
      updateProgress(40, 'Connecting to AI engine…');
      await sleep(400);
      updateProgress(60, 'Analyzing spending patterns…');
      const result = await FinSiteAPI.analyze(csvText);
      updateProgress(85, 'Generating insights…');
      await sleep(300);
      updateProgress(100, 'Analysis complete!');
      _data = result;
      await sleep(500);
      renderDashboard(result);
    } catch (err) {
      console.error('Analysis failed:', err);
      showError(err.message);
    }
  }

  // ── loading / error ─────────────────────────────────────────────────────────

  function showLoadingScreen() {
    document.body.innerHTML = `
      <div class="min-h-screen flex flex-col items-center justify-center gap-7 p-6"
           style="background:linear-gradient(135deg,#f0fdf6,#ffffff,#e8faf2);">
        <div class="app-bg" aria-hidden="true">
          <div class="app-bg__blob"></div><div class="app-bg__blob"></div><div class="app-bg__blob"></div>
        </div>
        <div class="${GC} p-12 max-w-sm w-full text-center relative z-10" style="animation:scaleIn 0.4s cubic-bezier(0.22,1,0.36,1);">
          <div class="spinner mx-auto mb-6"></div>
          <div class="text-xl font-extrabold text-gray-900 mb-2 tracking-tight">Analyzing Your Finances</div>
          <div id="loading-status" class="text-sm text-gray-400 mb-0">Initializing…</div>
          <div class="h-1.5 bg-green-100 rounded-full overflow-hidden mt-6">
            <div class="loading-progress-fill h-full rounded-full" id="loading-bar" style="width:0%;"></div>
          </div>
          <div id="loading-pct" class="text-xs text-gray-400 mt-2 font-mono">0%</div>
        </div>
      </div>
    `;
  }

  function updateProgress(pctVal, text) {
    const bar    = document.getElementById('loading-bar');
    const status = document.getElementById('loading-status');
    const pctEl  = document.getElementById('loading-pct');
    if (bar)    bar.style.width    = pctVal + '%';
    if (status) status.textContent = text;
    if (pctEl)  pctEl.textContent  = pctVal + '%';
  }

  function showError(msg) {
    document.body.innerHTML = `
      <div class="min-h-screen flex items-center justify-center p-6"
           style="background:linear-gradient(135deg,#f0fdf6,#ffffff);">
        <div class="${GC} p-12 max-w-sm w-full text-center" style="border-color:#fecaca;">
          <i class="bi bi-exclamation-triangle-fill text-5xl text-red-400 mb-4 block"></i>
          <div class="text-lg font-bold text-gray-900 mb-2">Analysis Failed</div>
          <div class="text-sm text-gray-500 mb-6">${escape(msg)}</div>
          <button class="btn btn-primary w-full" id="retry-btn">
            <i class="bi bi-arrow-clockwise mr-2"></i>Try Again
          </button>
        </div>
      </div>
    `;
    document.getElementById('retry-btn')?.addEventListener('click', () => location.reload());
  }

  // ── dashboard shell ─────────────────────────────────────────────────────────

  function renderDashboard(d) {
    document.body.innerHTML = `
      <div class="app-bg" aria-hidden="true">
        <div class="app-bg__blob"></div>
        <div class="app-bg__blob"></div>
        <div class="app-bg__blob"></div>
      </div>
      <div class="flex min-h-screen relative z-10">
        ${renderSidebar()}
        <div class="flex flex-col flex-1 min-h-screen" style="margin-left:240px;">
          ${renderTopBar()}
          <div class="content-area page flex-1 p-7 flex flex-col gap-5" id="content-area">
            ${renderDashboardPage(d)}
          </div>
        </div>
      </div>
    `;
    bindShellEvents();
    animateScoreRing();
  }

  // ── session helpers ─────────────────────────────────────────────────────────

  function _getSessionUser() {
    try { return JSON.parse(localStorage.getItem('finsite_session') || 'null'); }
    catch { return null; }
  }

  async function _logout() {
    try {
      if (window.FinSiteFirebase?.isConfigured()) {
        window.FinSiteFirebase.initFirebase();
        await window.FinSiteFirebase.getAuth().signOut();
      }
    } catch (_) {}
    localStorage.removeItem('finsite_session');
    window.location.replace('./auth.html');
  }

  // ── sidebar ─────────────────────────────────────────────────────────────────

  function renderSidebar() {
    const user     = _getSessionUser();
    const name     = user?.name || 'FinSite User';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'FS';

    const navLinks = NAV_ITEMS.map(n => `
      <div class="nav-item${n.id === _activePage ? ' active' : ''} flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium transition-all duration-150 select-none"
           data-page="${n.id}">
        <i class="bi ${n.icon} text-base w-5 text-center flex-shrink-0"></i>
        <span>${n.label}</span>
      </div>
    `).join('');

    return `
      <aside class="fixed left-0 top-0 h-screen flex flex-col z-50 overflow-hidden"
             style="width:240px;background:rgba(255,255,255,0.65);backdrop-filter:blur(32px) saturate(200%);-webkit-backdrop-filter:blur(32px) saturate(200%);border-right:1px solid rgba(16,193,101,0.14);box-shadow:4px 0 40px rgba(13,163,84,0.07);">

        <!-- logo -->
        <div class="flex items-center gap-3 px-5 py-5 border-b" style="border-color:rgba(16,193,101,0.1);">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center text-white font-extrabold text-sm flex-shrink-0 shadow-green-glow"
               style="background:linear-gradient(135deg,#0da354,#34d37e);">F</div>
          <span class="text-xl font-extrabold tracking-tight text-gray-900">
            <span class="text-green-600">Fin</span>Site
          </span>
        </div>

        <!-- nav -->
        <nav class="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
          <p class="text-[9.5px] font-bold uppercase tracking-widest px-3 pt-1 pb-2" style="color:rgba(13,163,84,0.4);">Main</p>
          ${navLinks}
          <p class="text-[9.5px] font-bold uppercase tracking-widest px-3 pt-4 pb-2" style="color:rgba(13,163,84,0.4);">Account</p>
          <div id="new-analysis-btn"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium text-gray-500 hover:text-green-700 hover:bg-green-50/70 transition-all duration-150">
            <i class="bi bi-plus-circle text-base w-5 text-center flex-shrink-0"></i>
            <span>New Analysis</span>
          </div>
          <div id="logout-btn"
               class="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50/60 transition-all duration-150">
            <i class="bi bi-box-arrow-left text-base w-5 text-center flex-shrink-0"></i>
            <span>Sign Out</span>
          </div>
        </nav>

        <!-- user chip -->
        <div class="px-3 pb-4 pt-3 border-t" style="border-color:rgba(16,193,101,0.1);">
          <div class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-green-50/60 cursor-pointer transition-all">
            <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                 style="background:linear-gradient(135deg,#0da354,#34d37e);box-shadow:0 2px 10px rgba(16,193,101,0.35);">
              ${escape(initials)}
            </div>
            <div class="min-w-0">
              <div class="text-[13px] font-semibold text-gray-800 truncate">${escape(name)}</div>
              <div class="text-[11px] text-gray-400 truncate">${escape(user?.email || 'Personal Plan')}</div>
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  // ── top bar ─────────────────────────────────────────────────────────────────

  function renderTopBar() {
    const navItem = NAV_ITEMS.find(n => n.id === _activePage) || NAV_ITEMS[0];
    return `
      <header class="sticky top-0 z-40 flex items-center justify-between px-7 h-16"
              style="background:rgba(255,255,255,0.75);backdrop-filter:blur(24px) saturate(200%);-webkit-backdrop-filter:blur(24px) saturate(200%);border-bottom:1px solid rgba(16,193,101,0.1);box-shadow:0 1px 20px rgba(13,163,84,0.05);">
        <div>
          <div class="text-xl font-bold text-gray-900 tracking-tight" id="topbar-title">${navItem.label}</div>
          <div class="text-xs text-gray-400">AI-powered analysis · Updated just now</div>
        </div>
        <div class="flex items-center gap-2.5">
          <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full animate-pulse">
            <span class="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"></span>Live Report
          </span>
          <button id="topbar-new-btn" title="New analysis"
                  class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-green-700 hover:bg-green-50 border border-green-100/60 transition-all text-base"
                  style="background:rgba(255,255,255,0.8);">
            <i class="bi bi-plus-lg"></i>
          </button>
          <button title="Notifications"
                  class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-green-700 hover:bg-green-50 border border-green-100/60 transition-all text-base"
                  style="background:rgba(255,255,255,0.8);">
            <i class="bi bi-bell"></i>
          </button>
        </div>
      </header>
    `;
  }

  // ── page switcher ───────────────────────────────────────────────────────────

  function switchPage(page) {
    _activePage = page;

    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const navItem = NAV_ITEMS.find(n => n.id === page);
    const titleEl = document.getElementById('topbar-title');
    if (titleEl && navItem) titleEl.textContent = navItem.label;

    const area = document.getElementById('content-area');
    if (!area) return;
    area.className = '';
    void area.offsetWidth;
    area.className = 'content-area page flex-1 p-7 flex flex-col gap-5';

    switch (page) {
      case 'dashboard':     area.innerHTML = renderDashboardPage(_data);     animateScoreRing(); break;
      case 'budget':        area.innerHTML = renderBudgetPage(_data);        break;
      case 'subscriptions': area.innerHTML = renderSubscriptionsPage(_data); break;
      case 'transactions':  area.innerHTML = renderTransactionsPage(_data);  break;
      case 'advice':        area.innerHTML = renderAdvicePage(_data);        break;
      case 'savings':       area.innerHTML = renderSavingsPage(_data);       break;
      case 'accounts':      area.innerHTML = renderAccountsPage(_data);      break;
    }
    bindContentEvents();
  }

  function bindShellEvents() {
    document.getElementById('new-analysis-btn')?.addEventListener('click', () => location.reload());
    document.getElementById('logout-btn')?.addEventListener('click', _logout);
    document.getElementById('topbar-new-btn')?.addEventListener('click', () => location.reload());
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => switchPage(el.dataset.page));
    });
    bindContentEvents();
  }

  function bindContentEvents() {
    document.getElementById('content-new-btn')?.addEventListener('click', () => location.reload());
  }

  // ── shared UI pieces ────────────────────────────────────────────────────────

  function statCard(label, value, badge, badgeUp, delay) {
    const badgeHtml = badge ? `
      <span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${badgeUp ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-500'}">
        <i class="bi ${badgeUp ? 'bi-arrow-up-short' : 'bi-arrow-down-short'} text-xs"></i>${badge}
      </span>` : '';
    return `
      <div class="${GC} p-6 flex flex-col gap-2.5 animate-fadeUp" style="animation-delay:${delay}s">
        <div class="text-[11px] font-semibold uppercase tracking-widest text-gray-400">${label}</div>
        <div class="text-3xl font-extrabold text-gray-900 tracking-tight font-mono leading-none">${value}</div>
        ${badgeHtml}
      </div>
    `;
  }

  function insightCard(icon, iconBg, iconColor, title, titleColor, body, foot) {
    return `
      <div class="${GC} p-4 flex items-start gap-4 hover:translate-x-1 transition-transform duration-150">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${iconBg}">
          <i class="bi ${icon} ${iconColor}"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold mb-0.5 ${titleColor || 'text-gray-900'}">${title}</div>
          <div class="text-[13px] text-gray-500 leading-relaxed">${body}</div>
          ${foot ? `<div class="mt-1.5 text-[12px] font-bold font-mono ${titleColor || 'text-gray-700'}">${foot}</div>` : ''}
        </div>
      </div>
    `;
  }

  // ── DASHBOARD PAGE ──────────────────────────────────────────────────────────

  function renderDashboardPage(d) {
    const netFlow = (d.totalIn || 0) - (d.totalOut || 0);
    const netPos  = netFlow >= 0;
    const score   = d.score || 0;
    const r       = 70, circ = 2 * Math.PI * r;
    const color   = scoreColor(score);
    const cats    = d.topCategories || [];
    const maxAmt  = Math.max(...cats.map(c => c.amount || 0), 1);
    const palette = ['#0da354','#16c165','#34d37e','#4ade80','#059669','#22c55e','#86efac'];

    const catRows = cats.map((cat, i) => {
      const w = Math.round((cat.amount / maxAmt) * 100);
      return `
        <div class="flex items-center gap-3 py-2.5 border-b border-green-50 last:border-0 animate-fadeUp" style="animation-delay:${0.04*i}s">
          <div class="w-2.5 h-2.5 rounded-full flex-shrink-0" style="background:${palette[i%palette.length]};"></div>
          <div class="flex-1 text-sm font-medium text-gray-700">${escape(cat.name)}</div>
          <div class="w-24 h-1.5 bg-green-50 rounded-full overflow-hidden flex-shrink-0">
            <div class="h-full rounded-full category-bar-fill" style="--w:${w}%;background:${palette[i%palette.length]};animation-delay:${0.08*i}s;"></div>
          </div>
          <div class="text-sm font-semibold text-gray-800 font-mono w-20 text-right">${fmt(cat.amount)}</div>
        </div>
      `;
    }).join('');

    return `
      <!-- stat row -->
      <div class="grid grid-cols-4 gap-4">
        ${statCard('Total Income',   fmt(d.totalIn),  null,                                    true,  0.05)}
        ${statCard('Total Spending', fmt(d.totalOut), null,                                    false, 0.10)}
        ${statCard('Net Cash Flow',  fmt(Math.abs(netFlow)), netPos?'Surplus':'Deficit',        netPos, 0.15)}
        ${statCard('Savings Rate',   `${d.savingsRate||0}%`, (d.savingsRate||0)>=20?'On track':'Below target', (d.savingsRate||0)>=20, 0.20)}
      </div>

      <!-- spending + score -->
      <div class="grid gap-4" style="grid-template-columns:1.5fr 1fr;">

        <!-- spending breakdown -->
        <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.1s">
          <div class="flex items-center justify-between mb-5">
            <div>
              <div class="text-base font-bold text-gray-900">Spending Breakdown</div>
              <div class="text-xs text-gray-400 mt-0.5">${d.txCount||'—'} transactions analyzed</div>
            </div>
            <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full">
              <i class="bi bi-tags-fill text-xs"></i> ${cats.length} categories
            </span>
          </div>
          ${catRows || '<p class="text-sm text-gray-400">No category data.</p>'}
        </div>

        <!-- health score -->
        <div class="${GC} p-6 flex flex-col items-center text-center gap-4 animate-fadeUp" style="animation-delay:.15s">
          <div>
            <div class="text-base font-bold text-gray-900">Health Score</div>
            <div class="text-xs text-gray-400 mt-0.5">Overall financial wellness</div>
          </div>
          <div class="score-ring-wrap">
            <svg width="170" height="170" style="transform:rotate(-90deg)">
              <circle cx="85" cy="85" r="${r}" fill="none" stroke="#f0fdf6" stroke-width="12"/>
              <circle cx="85" cy="85" r="${r}" fill="none" stroke="${color}"
                stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${circ}" stroke-dashoffset="${circ}" id="score-circle"
                style="transition:stroke-dashoffset 1.6s cubic-bezier(0.34,1.56,0.64,1);filter:drop-shadow(0 0 10px ${color}70);"/>
            </svg>
            <div class="score-ring-inner">
              <div class="text-5xl font-extrabold leading-none" style="color:${color};">${score}</div>
              <div class="text-2xl font-bold mt-0.5" style="color:${color};">${escape(d.grade||'')}</div>
              <div class="text-[10px] text-gray-400 font-mono mt-1 uppercase tracking-wider">Score</div>
            </div>
          </div>
          <div class="text-[13px] text-gray-500 leading-relaxed max-w-[200px]">${escape(d.health||'')}</div>
          ${d.quickWins ? `
            <div class="w-full text-left">
              <div class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">Quick Wins</div>
              <div class="flex flex-col gap-1.5">
                ${d.quickWins.map(w => `
                  <div class="flex items-start gap-2 text-[12px] text-gray-600">
                    <i class="bi bi-check-circle-fill text-green-500 text-sm flex-shrink-0 mt-px"></i>${escape(w)}
                  </div>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- AI summary -->
      <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.2s">
        <div class="flex items-center gap-2 mb-3">
          <i class="bi bi-robot text-green-500 text-lg"></i>
          <span class="text-sm font-bold text-gray-900">AI Summary</span>
        </div>
        <p class="text-sm text-gray-600 leading-relaxed">${escape(d.summary||'No summary available.')}</p>
      </div>
    `;
  }

  // ── BUDGET PAGE ─────────────────────────────────────────────────────────────

  function renderBudgetPage(d) {
    const trend  = d.monthlyTrend || [];
    const maxVal = Math.max(...trend.flatMap(t => [t.income||0, t.spending||0]), 1);
    const cats   = d.topCategories || [];
    const total  = cats.reduce((s, c) => s + (c.amount||0), 0) || 1;
    const palette = ['#0da354','#16c165','#34d37e','#4ade80','#059669','#22c55e','#86efac'];

    const bars = trend.map(t => {
      const incH = Math.round(((t.income||0)/maxVal)*140);
      const spH  = Math.round(((t.spending||0)/maxVal)*140);
      return `
        <div class="flex flex-col items-center gap-1.5 flex-1">
          <div class="flex items-end gap-1 h-[140px]">
            <div title="Income: ${fmt(t.income)}"
                 class="w-5 rounded-t-sm" style="height:${incH}px;background:#16c165;transition:height .6s ease;"></div>
            <div title="Spending: ${fmt(t.spending)}"
                 class="w-5 rounded-t-sm" style="height:${spH}px;background:#f87171;transition:height .6s ease;"></div>
          </div>
          <div class="text-[11px] text-gray-400 font-medium">${escape(t.month)}</div>
        </div>
      `;
    }).join('');

    const pieRows = cats.map((cat, i) => `
      <div class="flex items-center justify-between py-2.5 border-b border-green-50/80 last:border-0">
        <div class="flex items-center gap-2.5">
          <div class="w-3 h-3 rounded-full flex-shrink-0" style="background:${palette[i%palette.length]};"></div>
          <span class="text-sm font-medium text-gray-700">${escape(cat.name)}</span>
        </div>
        <div class="flex items-center gap-4">
          <span class="text-[11px] text-gray-400">${Math.round((cat.amount/total)*100)}%</span>
          <span class="text-sm font-semibold text-gray-800 font-mono">${fmt(cat.amount)}</span>
        </div>
      </div>
    `).join('');

    return `
      <div class="grid grid-cols-2 gap-4">

        <!-- monthly chart -->
        <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.05s">
          <div class="flex items-center justify-between mb-5">
            <div>
              <div class="text-base font-bold text-gray-900">Income vs Spending</div>
              <div class="text-xs text-gray-400 mt-0.5">Last ${trend.length} months</div>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-gray-400">
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-green-500 inline-block"></span>Income</span>
              <span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded bg-red-400 inline-block"></span>Spending</span>
            </div>
          </div>
          ${trend.length ? `<div class="flex items-end gap-3 px-2">${bars}</div>` : '<p class="text-sm text-gray-400">No trend data.</p>'}
        </div>

        <!-- category breakdown -->
        <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.10s">
          <div class="text-base font-bold text-gray-900 mb-4">Budget by Category</div>
          ${pieRows || '<p class="text-sm text-gray-400">No data.</p>'}
          <div class="mt-4 pt-4 border-t border-green-50 flex justify-between">
            <div>
              <div class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Tracked</div>
              <div class="text-xl font-extrabold text-gray-900 font-mono mt-1">${fmt(total)}</div>
            </div>
            <div class="text-right">
              <div class="text-[10px] font-bold uppercase tracking-widest text-gray-400">Savings Rate</div>
              <div class="text-xl font-extrabold text-green-600 font-mono mt-1">${d.savingsRate||0}%</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── SUBSCRIPTIONS PAGE ──────────────────────────────────────────────────────

  function renderSubscriptionsPage(d) {
    const subKeywords = /subscri|netflix|spotify|hulu|disney|amazon prime|apple|youtube|gym|membership|streaming|monthly|recurring/i;
    const subs = (d.wasteful || []).filter(w => subKeywords.test(w.title) || subKeywords.test(w.detail));
    const totalSubs = subs.reduce((s, w) => s + (w.amount||0), 0);

    const subCards = subs.map((s, i) => `
      <div class="${GC} p-4 flex items-center justify-between gap-4 animate-fadeUp" style="animation-delay:${.06*i}s">
        <div class="flex items-center gap-4">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center text-white flex-shrink-0"
               style="background:linear-gradient(135deg,#1c2820,#283530);">
            <i class="bi bi-arrow-repeat text-lg"></i>
          </div>
          <div>
            <div class="text-sm font-semibold text-gray-900">${escape(s.title)}</div>
            <div class="text-[12px] text-gray-400 mt-0.5">${escape(s.detail)}</div>
          </div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="text-lg font-bold text-red-500 font-mono">${fmt(s.amount)}<span class="text-[11px] text-gray-400 font-normal">/mo</span></div>
          <span class="text-[10px] font-semibold text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">Recurring</span>
        </div>
      </div>
    `).join('');

    return `
      <div class="grid grid-cols-4 gap-4">
        ${statCard('Recurring Detected', String(subs.length),          null, true,  .05)}
        ${statCard('Monthly Drain',      fmt(totalSubs),               'from subscriptions', false, .10)}
        ${statCard('Annual Cost',        fmt(totalSubs*12),            null, false, .15)}
        ${statCard('% of Spending',      `${d.totalOut ? Math.round((totalSubs/d.totalOut)*100) : 0}%`, null, false, .20)}
      </div>

      <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.1s">
        <div class="flex items-center justify-between mb-5">
          <div>
            <div class="text-base font-bold text-gray-900">Detected Subscriptions</div>
            <div class="text-xs text-gray-400 mt-0.5">Flagged by AI from your statement</div>
          </div>
          ${subs.length ? `<span class="text-[11px] font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-full">${subs.length} found</span>` : ''}
        </div>
        <div class="flex flex-col gap-3">
          ${subCards || `
            <div class="text-center py-10 text-gray-400">
              <i class="bi bi-check-circle text-4xl text-green-400 block mb-3"></i>
              <div class="text-sm">No obvious subscription drains detected — you look clean.</div>
            </div>
          `}
        </div>
      </div>

      <div class="${GCD} p-5 animate-fadeUp" style="animation-delay:.15s">
        <div class="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">
          <i class="bi bi-lightbulb-fill text-green-400 mr-1.5"></i>Tip
        </div>
        <div class="text-sm text-white/70 leading-relaxed">
          Cancel one subscription you haven't used in 30+ days. At ${fmt(totalSubs)}/mo that's
          <strong class="text-green-400">${fmt(totalSubs*12)}</strong> back per year.
        </div>
      </div>
    `;
  }

  // ── TRANSACTIONS PAGE ───────────────────────────────────────────────────────

  function renderTransactionsPage(d) {
    const cats    = d.topCategories || [];
    const palette = ['#0da354','#16c165','#34d37e','#4ade80','#059669','#22c55e','#86efac'];
    const maxAmt  = Math.max(...cats.map(c => c.amount||0), 1);

    const rows = cats.map((cat, i) => `
      <tr class="border-b border-green-50 hover:bg-green-50/40 transition-colors animate-fadeUp" style="animation-delay:${.04*i}s">
        <td class="px-5 py-3.5">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${palette[i%palette.length]};"></div>
            <span class="text-sm font-medium text-gray-800">${escape(cat.name)}</span>
          </div>
        </td>
        <td class="px-5 py-3.5 text-center text-[12px] text-gray-400">${cat.count||'—'} txns</td>
        <td class="px-5 py-3.5 text-right text-sm font-semibold text-gray-800 font-mono">${fmt(cat.amount)}</td>
        <td class="px-5 py-3.5 pr-6 text-right w-28">
          <div class="h-1.5 bg-green-50 rounded-full overflow-hidden ml-auto" style="max-width:80px;">
            <div class="h-full rounded-full" style="width:${Math.round(((cat.amount||0)/maxAmt)*100)}%;background:${palette[i%palette.length]};"></div>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="grid grid-cols-4 gap-4">
        ${statCard('Total Transactions', String(d.txCount||'—'), null, true,  .05)}
        ${statCard('Total Income',       fmt(d.totalIn),         null, true,  .10)}
        ${statCard('Total Spending',     fmt(d.totalOut),        null, false, .15)}
        ${statCard('Categories Found',   String(cats.length),    null, true,  .20)}
      </div>

      <div class="${GC} overflow-hidden animate-fadeUp" style="animation-delay:.1s">
        <div class="px-6 py-4 border-b border-green-50">
          <div class="text-base font-bold text-gray-900">Spending by Category</div>
          <div class="text-xs text-gray-400 mt-0.5">From your uploaded bank statement</div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead class="bg-green-50/60">
              <tr>
                <th class="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400">Category</th>
                <th class="px-5 py-3 text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Volume</th>
                <th class="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400">Amount</th>
                <th class="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-widest text-gray-400 pr-6">Share</th>
              </tr>
            </thead>
            <tbody>
              ${rows || `<tr><td colspan="4" class="py-10 text-center text-sm text-gray-400">No transaction data available.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ── FINANCIAL ADVICE PAGE ───────────────────────────────────────────────────

  function renderAdvicePage(d) {
    const wasteful    = d.wasteful    || [];
    const investments = d.investments || [];

    const wasteItems = wasteful.map((w, i) =>
      insightCard('bi-exclamation-triangle-fill', 'bg-red-50', 'text-red-400',
        escape(w.title), 'text-red-500', escape(w.detail),
        w.amount ? `Wasting ~${fmt(w.amount)}/mo` : null)
    ).join('');

    const investItems = investments.map((inv, i) =>
      insightCard('bi-graph-up-arrow', 'bg-gray-900', 'text-green-400',
        escape(inv.title), null, escape(inv.detail), null)
    ).join('');

    const quickWins = (d.quickWins || []).map((w, i) => `
      <div class="flex items-start gap-3 p-4 bg-green-50/60 rounded-xl border border-green-100/60 animate-fadeUp" style="animation-delay:${.06*i}s">
        <div class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-green-700 bg-green-200 flex-shrink-0 mt-px">${i+1}</div>
        <div class="text-[13px] text-gray-600 leading-relaxed">${escape(w)}</div>
      </div>
    `).join('');

    return `
      <div class="grid grid-cols-2 gap-4">

        <!-- wasteful -->
        <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.05s">
          <div class="flex items-center justify-between mb-4">
            <div class="text-base font-bold text-gray-900">Where Money Leaks</div>
            ${wasteful.length ? `<span class="text-[11px] font-semibold text-red-500 bg-red-50 px-2.5 py-1 rounded-full">${wasteful.length} issues</span>` : ''}
          </div>
          <div class="flex flex-col gap-3">
            ${wasteItems || '<p class="text-sm text-gray-400">No wasteful spending detected.</p>'}
          </div>
        </div>

        <!-- investments -->
        <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.10s">
          <div class="text-base font-bold text-gray-900 mb-4">Investment Opportunities</div>
          <div class="flex flex-col gap-3">
            ${investItems || '<p class="text-sm text-gray-400">No investment data available.</p>'}
          </div>
        </div>
      </div>

      <!-- quick wins -->
      <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.15s">
        <div class="flex items-center gap-2 mb-4">
          <i class="bi bi-lightning-fill text-yellow-400 text-lg"></i>
          <div class="text-base font-bold text-gray-900">Quick Wins</div>
          <span class="text-[11px] text-gray-400 ml-1">Highest impact, lowest effort</span>
        </div>
        <div class="flex flex-col gap-2.5">
          ${quickWins || '<p class="text-sm text-gray-400">No quick wins available.</p>'}
        </div>
      </div>
    `;
  }

  // ── SAVINGS PAGE ────────────────────────────────────────────────────────────

  function renderSavingsPage(d) {
    const savingsItems   = d.savings || [];
    const totalPotential = savingsItems.reduce((s, i) => s + (i.potential||0), 0);
    const rate           = d.savingsRate || 0;
    const r = 55, circ = 2 * Math.PI * r;
    const rateColor      = rate >= 20 ? '#0da354' : rate >= 10 ? '#f59e0b' : '#f04040';

    const saveCards = savingsItems.map((s, i) => `
      <div class="${GC} p-4 flex items-start gap-4 animate-fadeUp" style="animation-delay:${.06*i}s">
        <div class="w-10 h-10 rounded-xl flex items-center justify-center bg-green-100 flex-shrink-0">
          <i class="bi bi-lightbulb-fill text-green-500 text-lg"></i>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-semibold text-gray-900">${escape(s.title)}</div>
          <div class="text-[13px] text-gray-500 mt-0.5 leading-relaxed">${escape(s.detail)}</div>
        </div>
        ${s.potential ? `
          <div class="text-right flex-shrink-0">
            <div class="text-base font-bold text-green-600 font-mono">${fmt(s.potential)}</div>
            <div class="text-[10px] text-gray-400">/ month</div>
          </div>
        ` : ''}
      </div>
    `).join('');

    return `
      <div class="grid grid-cols-3 gap-4">

        <!-- savings rate ring -->
        <div class="${GC} p-6 flex flex-col items-center text-center gap-4 animate-fadeUp" style="animation-delay:.05s">
          <div class="text-base font-bold text-gray-900">Savings Rate</div>
          <div class="relative inline-flex items-center justify-center">
            <svg width="130" height="130" style="transform:rotate(-90deg)">
              <circle cx="65" cy="65" r="${r}" fill="none" stroke="#f0fdf6" stroke-width="10"/>
              <circle cx="65" cy="65" r="${r}" fill="none" stroke="${rateColor}"
                stroke-width="10" stroke-linecap="round"
                stroke-dasharray="${circ}"
                stroke-dashoffset="${circ - (rate/100)*circ}"
                style="filter:drop-shadow(0 0 6px ${rateColor}70);transition:stroke-dashoffset 1.4s ease;"/>
            </svg>
            <div class="absolute text-center">
              <div class="text-3xl font-extrabold leading-none" style="color:${rateColor};">${rate}%</div>
              <div class="text-[10px] text-gray-400 mt-1">saved</div>
            </div>
          </div>
          <div class="text-[12px] text-gray-500 leading-relaxed">
            ${rate >= 20 ? '🎉 Excellent! Above the 20% target.' : rate >= 10 ? '⚠️ Decent — push toward 20%.' : '🚨 Below 10% — cut expenses first.'}
          </div>
        </div>

        <!-- potential card -->
        <div class="${GCD} p-6 flex flex-col justify-center items-center text-center animate-fadeUp" style="animation-delay:.10s">
          <div class="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Monthly Potential</div>
          <div class="text-5xl font-extrabold text-green-400 font-mono leading-none">${fmtShort(totalPotential)}</div>
          <div class="text-[11px] text-white/40 mt-2">If all tips applied</div>
          <div class="mt-5 pt-4 border-t border-white/10 w-full">
            <div class="text-[10px] text-white/40 mb-1">Annual potential</div>
            <div class="text-2xl font-bold text-green-300 font-mono">${fmtShort(totalPotential * 12)}</div>
          </div>
        </div>

        <!-- snapshot -->
        <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.15s">
          <div class="text-base font-bold text-gray-900 mb-4">Snapshot</div>
          ${[
            { label: 'Total Income',   val: fmt(d.totalIn)           },
            { label: 'Total Spending', val: fmt(d.totalOut)          },
            { label: 'Net Surplus',    val: fmt((d.totalIn||0)-(d.totalOut||0)) },
            { label: 'Tips Available', val: `${savingsItems.length} tips`      },
          ].map(s => `
            <div class="flex justify-between items-center py-2.5 border-b border-green-50 last:border-0">
              <span class="text-[12px] text-gray-400">${s.label}</span>
              <span class="text-sm font-semibold text-gray-800 font-mono">${s.val}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- tips list -->
      <div>
        <div class="text-base font-bold text-gray-900 mb-3">Savings Opportunities</div>
        <div class="flex flex-col gap-3">
          ${saveCards || '<p class="text-sm text-gray-400">No savings suggestions available.</p>'}
        </div>
      </div>
    `;
  }

  // ── ACCOUNTS PAGE ───────────────────────────────────────────────────────────

  function renderAccountsPage(d) {
    const netFlow = (d.totalIn||0) - (d.totalOut||0);
    const netPos  = netFlow >= 0;
    const color   = scoreColor(d.score||0);

    return `
      <!-- hero banner -->
      <div class="${GCD} p-6 flex items-center justify-between flex-wrap gap-5 animate-fadeUp" style="animation-delay:.05s">
        <div>
          <div class="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Statement Period</div>
          <div class="text-xl font-extrabold text-white tracking-tight">Analyzed Account</div>
          <div class="text-[12px] text-white/40 mt-1">${d.txCount||'—'} transactions · ${(d.topCategories||[]).length} categories</div>
        </div>
        <div class="text-right">
          <div class="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">Financial Health</div>
          <div class="text-5xl font-extrabold" style="color:${color};">${d.grade||'—'}</div>
          <div class="text-[12px] text-white/40 mt-1">Score: ${d.score||0}/100</div>
        </div>
      </div>

      <!-- stat row -->
      <div class="grid grid-cols-4 gap-4">
        ${statCard('Total Income',   fmt(d.totalIn),         null, true,  .05)}
        ${statCard('Total Spending', fmt(d.totalOut),        null, false, .10)}
        ${statCard('Net Flow',       fmt(Math.abs(netFlow)), netPos?'Surplus':'Deficit', netPos, .15)}
        ${statCard('Savings Rate',   `${d.savingsRate||0}%`, (d.savingsRate||0)>=20?'On track':'Below target', (d.savingsRate||0)>=20, .20)}
      </div>

      <div class="grid grid-cols-2 gap-4">

        <!-- AI summary -->
        <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.1s">
          <div class="flex items-center gap-2 mb-4">
            <i class="bi bi-robot text-green-500 text-lg"></i>
            <div class="text-base font-bold text-gray-900">AI Analysis Summary</div>
          </div>
          <p class="text-sm text-gray-600 leading-relaxed mb-4">${escape(d.summary||'')}</p>
          <div class="p-4 bg-green-50/60 rounded-xl border border-green-100/60">
            <div class="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Health Assessment</div>
            <div class="text-[13px] text-gray-600 leading-relaxed">${escape(d.health||'')}</div>
          </div>
        </div>

        <!-- top categories -->
        <div class="${GC} p-6 animate-fadeUp" style="animation-delay:.15s">
          <div class="text-base font-bold text-gray-900 mb-4">Top Spending Categories</div>
          ${(d.topCategories||[]).slice(0,5).map((cat,i) => `
            <div class="flex items-center justify-between py-2.5 border-b border-green-50 last:border-0">
              <span class="text-sm font-medium text-gray-700">${i+1}. ${escape(cat.name)}</span>
              <span class="text-sm font-semibold text-gray-800 font-mono">${fmt(cat.amount)}</span>
            </div>
          `).join('') || '<p class="text-sm text-gray-400">No data.</p>'}
        </div>
      </div>

      <div class="flex justify-center pt-2 animate-fadeUp" style="animation-delay:.2s">
        <button class="btn btn-primary px-8" id="content-new-btn">
          <i class="bi bi-arrow-clockwise mr-2"></i>Start a New Analysis
        </button>
      </div>
    `;
  }

  // ── animate score ring ──────────────────────────────────────────────────────

  function animateScoreRing() {
    setTimeout(() => {
      const circle = document.getElementById('score-circle');
      if (circle && _data) {
        const r = 70, circ = 2 * Math.PI * r;
        circle.style.strokeDashoffset = circ - ((_data.score||0)/100) * circ;
      }
    }, 300);
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  return { init, startAnalysis };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('analyze-btn')) FinSiteApp.init();
});
