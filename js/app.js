/**
 * FINSITE — app.js
 * Main application logic: controls state, renders results dashboard
 */

const FinSiteApp = (() => {

  let _data = null;
  let _activeTab = 'overview';

  // ── Currency formatter
  const fmt = (n) => {
    if (n === undefined || n === null) return '—';
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD', maximumFractionDigits: 0
    }).format(n);
  };

  const fmtShort = (n) => {
    if (!n && n !== 0) return '—';
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`;
    return fmt(n);
  };

  const pct = (n) => `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%`;
  const escape = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');

  // ── Score color
  function scoreColor(s) {
    if (s >= 80) return 'var(--green-600)';
    if (s >= 60) return 'var(--green-500)';
    if (s >= 40) return '#f59e0b';
    return 'var(--red)';
  }

  // ── Init app (upload page)
  function init() {
    const analyzeBtn = document.getElementById('analyze-btn');
    const apiKeyInput = document.getElementById('api-key');
    const fileInput = document.getElementById('file-input');

    // Auto-fill key from local config and hide the input section
    if (window.FINSITE_KEY && apiKeyInput) {
      apiKeyInput.value = window.FINSITE_KEY;
      const keySection = document.getElementById('api-key-section');
      if (keySection) keySection.style.display = 'none';
    }

    // Enable/disable analyze button
    function checkReady() {
      const hasFile = !!FinSiteUpload.getCurrentFile();
      const hasKey = (apiKeyInput?.value || '').trim().length > 10;
      // Allow proxy mode (no key) OR direct mode (with key)
      if (analyzeBtn) analyzeBtn.disabled = !hasFile;
    }

    if (apiKeyInput) apiKeyInput.addEventListener('input', checkReady);

    // Init upload zone
    FinSiteUpload.init('upload-zone', (file) => {
      checkReady();
    });

    // Analyze button click
    if (analyzeBtn) {
      analyzeBtn.addEventListener('click', startAnalysis);
    }
  }

  // ── Start analysis flow
  async function startAnalysis() {
    const file = FinSiteUpload.getCurrentFile();
    if (!file) return;

    const apiKey = document.getElementById('api-key')?.value || null;

    // Switch to loading screen
    showLoadingScreen();

    try {
      // Read CSV
      updateProgress(20, 'Reading your bank statement…');
      const csvText = await FinSiteUpload.readFile(file);

      // Call API
      updateProgress(40, 'Connecting to AI engine…');
      await sleep(400);

      updateProgress(60, 'Analyzing spending patterns…');
      const result = await FinSiteAPI.analyze(csvText, apiKey);

      updateProgress(85, 'Generating insights…');
      await sleep(300);

      updateProgress(100, 'Analysis complete!');
      _data = result;

      await sleep(500);

      // Render dashboard
      renderDashboard(result);

    } catch (err) {
      console.error('Analysis failed:', err);
      showError(err.message);
    }
  }

  // ── Loading screen
  function showLoadingScreen() {
    document.body.innerHTML = `
      <div class="loading-screen">
        <div class="blob-bg" style="width:300px;height:300px;top:-50px;right:-50px;background:var(--green-100);"></div>
        <div class="loading-card">
          <div class="spinner" style="margin:0 auto 24px;"></div>
          <div style="font-size:22px;font-weight:800;margin-bottom:8px;">Analyzing Your Finances</div>
          <div id="loading-status" style="font-size:13px;color:var(--text-muted);margin-bottom:0;">Initializing…</div>
          <div class="loading-progress-track" style="margin-top:20px;">
            <div class="loading-progress-fill" id="loading-bar" style="width:0%;"></div>
          </div>
          <div id="loading-pct" style="font-size:11px;color:var(--text-muted);margin-top:8px;font-family:'JetBrains Mono',monospace;">0%</div>
        </div>
      </div>
    `;
  }

  function updateProgress(pctVal, text) {
    const bar = document.getElementById('loading-bar');
    const status = document.getElementById('loading-status');
    const pctEl = document.getElementById('loading-pct');
    if (bar) bar.style.width = pctVal + '%';
    if (status) status.textContent = text;
    if (pctEl) pctEl.textContent = pctVal + '%';
  }

  function showError(msg) {
    document.body.innerHTML = `
      <div class="loading-screen">
        <div class="loading-card" style="border-color:#fecaca;">
          <div style="font-size:40px;margin-bottom:16px;">⚠️</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Analysis Failed</div>
          <div style="font-size:13px;color:var(--text-secondary);margin-bottom:24px;">${escape(msg)}</div>
          <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
        </div>
      </div>
    `;
  }

  // ── Render full dashboard
  function renderDashboard(d) {
    const netFlow = (d.totalIn || 0) - (d.totalOut || 0);
    const netPositive = netFlow >= 0;

    document.body.innerHTML = `
      <div class="app-shell">
        ${renderSidebar()}
        <div class="main-area">
          ${renderTopBar(d)}
          <div class="content-area page" id="content-area">
            ${renderStatCards(d, netFlow, netPositive)}
            <div class="grid-7-5">
              ${renderSpendingPanel(d)}
              ${renderScorePanel(d)}
            </div>
            <div class="grid-2">
              ${renderInsightsPanel(d)}
              ${renderInvestPanel(d)}
            </div>
            ${renderTransactionsHint(d)}
          </div>
        </div>
      </div>
    `;

    bindDashboardEvents();
    animateNumbers();
  }

  function renderSidebar() {
    return `
      <aside class="sidebar">
        <div class="sidebar__logo">
          <div class="logo-text"><span>Fin</span>Site</div>
        </div>
        <nav class="sidebar__nav">
          <div class="nav-section-label">Analysis</div>
          <div class="nav-item active" data-tab="overview">
            <span class="nav-icon">📊</span> Overview
          </div>
          <div class="nav-item" data-tab="spending">
            <span class="nav-icon">💳</span> Spending
          </div>
          <div class="nav-item" data-tab="savings">
            <span class="nav-icon">💡</span> Savings
          </div>
          <div class="nav-item" data-tab="invest">
            <span class="nav-icon">📈</span> Investments
          </div>
          <div class="nav-section-label">Account</div>
          <div class="nav-item" id="new-analysis-btn" style="cursor:pointer;">
            <span class="nav-icon">➕</span> New Analysis
          </div>
        </nav>
        <div class="sidebar__footer">
          <div class="user-chip">
            <div class="user-avatar">FS</div>
            <div>
              <div class="user-name">FinSite User</div>
              <div class="user-role">Personal Plan</div>
            </div>
          </div>
        </div>
      </aside>
    `;
  }

  function renderTopBar(d) {
    return `
      <header class="topbar">
        <div class="topbar__left">
          <div class="topbar__title">Financial Dashboard</div>
          <div class="topbar__sub">AI-powered analysis · Generated just now</div>
        </div>
        <div class="topbar__right">
          <span class="badge badge-live badge-dot">Live Report</span>
          <button class="topbar-icon-btn" title="Export">📤</button>
          <button class="topbar-icon-btn" title="Settings">⚙️</button>
        </div>
      </header>
    `;
  }

  function renderStatCards(d, netFlow, netPositive) {
    const cards = [
      { label: 'Total Income', value: fmt(d.totalIn), change: null, positive: true, delay: 1 },
      { label: 'Total Spending', value: fmt(d.totalOut), change: null, positive: false, delay: 2 },
      { label: 'Net Cash Flow', value: fmt(Math.abs(netFlow)), change: netPositive ? '▲ Surplus' : '▼ Deficit', positive: netPositive, delay: 3 },
      { label: 'Savings Rate', value: `${d.savingsRate || 0}%`, change: d.savingsRate >= 20 ? 'On track' : 'Below target', positive: (d.savingsRate || 0) >= 20, delay: 4 },
    ];

    return `
      <div class="grid-4">
        ${cards.map(c => `
          <div class="card card--solid stat-card animate-fadeUp delay-${c.delay}">
            <div class="stat-card__label">${c.label}</div>
            <div class="stat-card__value font-mono" data-value="${c.value}">${c.value}</div>
            ${c.change ? `<span class="stat-card__change stat-card__change--${c.positive ? 'up' : 'down'}">${c.change}</span>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderSpendingPanel(d) {
    const cats = d.topCategories || [];
    const maxAmt = Math.max(...cats.map(c => c.amount || 0), 1);
    const colors = ['#10c165','#059669','#0d9448','#16a34a','#22c55e','#4ade80','#86efac'];

    const rows = cats.map((cat, i) => {
      const w = Math.round((cat.amount / maxAmt) * 100);
      return `
        <div class="category-row animate-fadeUp" style="animation-delay:${0.05 * i}s">
          <div class="category-dot" style="background:${colors[i % colors.length]};"></div>
          <div class="category-label">${escape(cat.name)}</div>
          <div class="category-bar-track">
            <div class="category-bar-fill" style="--w:${w}%;background:${colors[i % colors.length]};animation-delay:${0.1 * i}s;"></div>
          </div>
          <div class="category-amount">${fmt(cat.amount)}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="card card--solid panel animate-fadeUp delay-2">
        <div class="section-header">
          <div>
            <div class="section-title">Spending Breakdown</div>
            <div class="section-sub">${d.txCount || '—'} transactions analyzed</div>
          </div>
          <span class="badge badge-green">${cats.length} categories</span>
        </div>
        ${rows || '<div style="color:var(--text-muted);font-size:13px;">No category data available.</div>'}
      </div>
    `;
  }

  function renderScorePanel(d) {
    const score = d.score || 0;
    const r = 70;
    const circumference = 2 * Math.PI * r;
    const color = scoreColor(score);

    return `
      <div class="card card--solid panel animate-fadeUp delay-3" style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:20px;">
        <div>
          <div class="section-title">Health Score</div>
          <div class="section-sub">Overall financial wellness</div>
        </div>

        <div class="score-ring-wrap">
          <svg width="170" height="170" style="transform:rotate(-90deg);">
            <circle cx="85" cy="85" r="${r}" fill="none" stroke="var(--gray-100)" stroke-width="12"/>
            <circle cx="85" cy="85" r="${r}" fill="none" stroke="${color}"
              stroke-width="12" stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${circumference}"
              id="score-circle"
              style="transition:stroke-dashoffset 1.6s cubic-bezier(0.34,1.56,0.64,1);filter:drop-shadow(0 0 8px ${color}60);"
            />
          </svg>
          <div class="score-ring-inner">
            <div style="font-size:44px;font-weight:800;color:${color};line-height:1;">${score}</div>
            <div style="font-size:28px;font-weight:700;color:${color};">${escape(d.grade || '')}</div>
            <div style="font-size:11px;color:var(--text-muted);font-family:'JetBrains Mono',monospace;margin-top:2px;">SCORE</div>
          </div>
        </div>

        <div style="font-size:13px;color:var(--text-secondary);line-height:1.65;max-width:240px;">
          ${escape(d.health || '')}
        </div>

        ${d.quickWins ? `
          <div style="width:100%;text-align:left;">
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);margin-bottom:10px;">Quick Wins</div>
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${d.quickWins.map(w => `
                <div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-secondary);">
                  <span style="color:var(--green-500);font-size:14px;flex-shrink:0;">✓</span>${escape(w)}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div style="width:100%;padding:16px;background:var(--gray-50);border-radius:var(--r-md);border:1px solid var(--border-soft);">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">AI SUMMARY</div>
          <div style="font-size:13px;color:var(--text-secondary);line-height:1.65;">${escape(d.summary || '')}</div>
        </div>
      </div>
    `;
  }

  function renderInsightsPanel(d) {
    const wasteful = d.wasteful || [];
    const savings = d.savings || [];

    const wasteItems = wasteful.map((w, i) => `
      <div class="insight-item animate-fadeUp" style="animation-delay:${0.08*i}s">
        <div class="insight-icon insight-icon--red">🚨</div>
        <div>
          <div class="insight-title" style="color:var(--red);">${escape(w.title)}</div>
          <div class="insight-body">${escape(w.detail)}</div>
          ${w.amount ? `<div style="margin-top:6px;font-size:12px;font-weight:600;color:var(--red);font-family:'JetBrains Mono',monospace;">Wasting ~${fmt(w.amount)}/mo</div>` : ''}
        </div>
      </div>
    `).join('');

    const saveItems = savings.map((s, i) => `
      <div class="insight-item animate-fadeUp" style="animation-delay:${0.08*i}s">
        <div class="insight-icon insight-icon--green">💡</div>
        <div>
          <div class="insight-title">${escape(s.title)}</div>
          <div class="insight-body">${escape(s.detail)}</div>
          ${s.potential ? `<div style="margin-top:6px;font-size:12px;font-weight:600;color:var(--green-600);font-family:'JetBrains Mono',monospace;">Save ~${fmt(s.potential)}/mo</div>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="card card--solid panel animate-fadeUp delay-4">
        <div class="section-header">
          <div class="section-title">Where Money Leaks</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px;">
          ${wasteItems || '<div style="color:var(--text-muted);font-size:13px;">No wasteful spending detected.</div>'}
        </div>
        <div class="divider" style="margin-bottom:20px;"></div>
        <div class="section-header">
          <div class="section-title">Savings Opportunities</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${saveItems || '<div style="color:var(--text-muted);font-size:13px;">No suggestions available.</div>'}
        </div>
      </div>
    `;
  }

  function renderInvestPanel(d) {
    const investments = d.investments || [];

    const items = investments.map((inv, i) => `
      <div class="insight-item animate-fadeUp" style="animation-delay:${0.1*i}s">
        <div class="insight-icon" style="background:var(--black);color:var(--white);">📈</div>
        <div>
          <div class="insight-title">${escape(inv.title)}</div>
          <div class="insight-body">${escape(inv.detail)}</div>
        </div>
      </div>
    `).join('');

    return `
      <div class="card card--solid panel animate-fadeUp delay-5">
        <div class="section-header">
          <div>
            <div class="section-title">Investment Opportunities</div>
            <div class="section-sub">Based on your spending patterns</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${items || '<div style="color:var(--text-muted);font-size:13px;">No investment data available.</div>'}
        </div>

        <div style="margin-top:24px;padding:20px;background:var(--gray-950);border-radius:var(--r-lg);color:var(--white);">
          <div style="font-size:11px;color:rgba(255,255,255,0.4);font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px;">Potential Monthly Savings</div>
          <div style="font-size:36px;font-weight:800;color:var(--green-400);font-family:'JetBrains Mono',monospace;">
            ${fmt(d.savings?.reduce((acc, s) => acc + (s.potential || 0), 0) || 0)}
          </div>
          <div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:4px;">If all savings tips are applied</div>
        </div>
      </div>
    `;
  }

  function renderTransactionsHint(d) {
    return `
      <div class="card card--solid panel animate-fadeUp delay-6">
        <div class="section-header">
          <div>
            <div class="section-title">Statement Summary</div>
            <div class="section-sub">Parsed from your uploaded statement</div>
          </div>
          <button class="btn btn-ghost" onclick="location.reload()">↩ New Analysis</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;">
          ${[
            { label: 'Transactions', val: d.txCount || '—' },
            { label: 'Income', val: fmt(d.totalIn) },
            { label: 'Spending', val: fmt(d.totalOut) },
            { label: 'Savings Rate', val: `${d.savingsRate || 0}%` },
            { label: 'Top Category', val: d.topCategories?.[0]?.name || '—' },
            { label: 'Health Grade', val: d.grade || '—' },
          ].map(s => `
            <div style="padding:14px;background:var(--gray-50);border-radius:var(--r-md);border:1px solid var(--border-soft);">
              <div style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:6px;">${s.label}</div>
              <div style="font-size:20px;font-weight:700;font-family:'JetBrains Mono',monospace;">${s.val}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ── Bind sidebar nav events
  function bindDashboardEvents() {
    // Score ring animation
    setTimeout(() => {
      const circle = document.getElementById('score-circle');
      if (circle && _data) {
        const r = 70;
        const circumference = 2 * Math.PI * r;
        const offset = circumference - ((_data.score || 0) / 100) * circumference;
        circle.style.strokeDashoffset = offset;
      }
    }, 400);

    // New analysis
    const newBtn = document.getElementById('new-analysis-btn');
    if (newBtn) newBtn.addEventListener('click', () => location.reload());

    // Nav items (visual only for now - all data already shown)
    document.querySelectorAll('[data-tab]').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('[data-tab]').forEach(n => n.classList.remove('active'));
        item.classList.add('active');
      });
    });
  }

  // ── Animate number counters
  function animateNumbers() {
    // Numbers just fade in via CSS - could add counter animation here
  }

  // ── Utility
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  return { init, startAnalysis };
})();

// Boot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('analyze-btn')) {
    FinSiteApp.init();
  }
});
