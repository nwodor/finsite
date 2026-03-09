// handling all the AI API calls here — routing through my PHP proxy to keep the key server-side

const FinSiteAPI = (() => {

  // building the prompt to send to the AI — telling it exactly what format to return
  function buildPrompt(csvText) {
    const preview = csvText.slice(0, 7000);
    return `You are FinSite AI — a sharp, no-nonsense personal finance analyst.
A user has uploaded their bank statement (may be CSV, Excel, PDF, or Word format — extract the transaction data regardless). Analyze it carefully and return ONLY a valid JSON object (no markdown fences, no explanation, no preamble).

Use this EXACT structure:

{
  "score": <integer 0-100, financial health score>,
  "grade": "<letter grade: A+, A, B+, B, C+, C, D, F>",
  "summary": "<2-3 crisp sentences summarizing their financial situation>",
  "health": "<one candid sentence about their financial health>",
  "totalIn": <total credits/income, number>,
  "totalOut": <total debits/spending, number>,
  "txCount": <number of transactions>,
  "savingsRate": <percentage of income saved, number 0-100>,
  "topCategories": [
    {"name": "<category name>", "amount": <number>, "count": <tx count>},
    ... (up to 7 categories, sorted by amount descending)
  ],
  "monthlyTrend": [
    {"month": "<MMM>", "income": <number>, "spending": <number>},
    ... (up to 6 months if data available)
  ],
  "wasteful": [
    {"title": "<concise title>", "detail": "<specific, actionable observation>", "amount": <estimated monthly waste, number>},
    ... (3-5 items)
  ],
  "savings": [
    {"title": "<concise title>", "detail": "<specific, actionable tip>", "potential": <estimated monthly savings, number>},
    ... (3-5 items)
  ],
  "investments": [
    {"title": "<investment type or vehicle>", "detail": "<why it fits their situation and how to start>"},
    ... (3-4 items)
  ],
  "quickWins": [
    "<one short actionable tip>",
    ... (3 quick wins)
  ]
}

Bank statement content:
${preview}`;
  }

  // routing through my PHP proxy — the API key never touches the browser
  async function callProxy(csvText) {
    const formData = new FormData();
    formData.append('prompt', buildPrompt(csvText));

    const response = await fetch('./php/analyze.php', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const err = await response.text().catch(() => '');
      throw new Error(err || `HTTP ${response.status}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return parseJSON(data.result || '{}');
  }

  // stripping markdown fences out — the API sometimes wraps JSON even when told not to
  function parseJSON(raw) {
    const clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); }
        catch (e2) { throw new Error('Failed to parse AI response'); }
      } else {
        throw new Error('Failed to parse AI response');
      }
    }
    return sanitizeResponse(parsed);
  }

  // stripping any HTML from AI string fields so injected markup can't reach the DOM
  function sanitizeStr(v) {
    if (typeof v !== 'string') return '';
    return v.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // validating the shape of the AI response and clamping numbers to safe ranges
  function sanitizeResponse(d) {
    if (!d || typeof d !== 'object') throw new Error('Invalid AI response structure');
    return {
      score:          Math.min(100, Math.max(0, parseInt(d.score) || 0)),
      grade:          sanitizeStr(d.grade).slice(0, 3) || 'C',
      summary:        sanitizeStr(d.summary).slice(0, 500),
      health:         sanitizeStr(d.health).slice(0, 300),
      totalIn:        parseFloat(d.totalIn)  || 0,
      totalOut:       parseFloat(d.totalOut) || 0,
      txCount:        parseInt(d.txCount)    || 0,
      savingsRate:    Math.min(100, Math.max(0, parseFloat(d.savingsRate) || 0)),
      topCategories:  Array.isArray(d.topCategories)
        ? d.topCategories.slice(0, 10).map(c => ({
            name:   sanitizeStr(c.name).slice(0, 60),
            amount: parseFloat(c.amount) || 0,
            count:  parseInt(c.count)   || 0,
          }))
        : [],
      monthlyTrend:   Array.isArray(d.monthlyTrend)
        ? d.monthlyTrend.slice(0, 12).map(m => ({
            month:    sanitizeStr(m.month).slice(0, 10),
            income:   parseFloat(m.income)   || 0,
            spending: parseFloat(m.spending) || 0,
          }))
        : [],
      wasteful:       Array.isArray(d.wasteful)
        ? d.wasteful.slice(0, 8).map(w => ({
            title:  sanitizeStr(w.title).slice(0, 100),
            detail: sanitizeStr(w.detail).slice(0, 300),
            amount: parseFloat(w.amount) || 0,
          }))
        : [],
      savings:        Array.isArray(d.savings)
        ? d.savings.slice(0, 8).map(s => ({
            title:     sanitizeStr(s.title).slice(0, 100),
            detail:    sanitizeStr(s.detail).slice(0, 300),
            potential: parseFloat(s.potential) || 0,
          }))
        : [],
      investments:    Array.isArray(d.investments)
        ? d.investments.slice(0, 6).map(i => ({
            title:  sanitizeStr(i.title).slice(0, 100),
            detail: sanitizeStr(i.detail).slice(0, 300),
          }))
        : [],
      quickWins:      Array.isArray(d.quickWins)
        ? d.quickWins.slice(0, 6).map(q => sanitizeStr(q).slice(0, 200))
        : [],
    };
  }

  // main entry — always going through the PHP proxy
  async function analyze(csvText) {
    return callProxy(csvText);
  }

  return { analyze, buildPrompt };
})();

if (typeof module !== 'undefined') module.exports = FinSiteAPI;
