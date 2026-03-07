// handling all the AI API calls here — either direct from the browser or through my PHP proxy

const FinSiteAPI = (() => {

  const MODEL = 'claude-sonnet-4-20250514';
  const MAX_TOKENS = 3000;

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

  // calling the AI directly from the browser — needs the dangerous-direct-browser-access header
  async function callDirect(csvText, apiKey) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: buildPrompt(csvText) }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const raw = data?.content?.[0]?.text || '{}';
    return parseJSON(raw);
  }

  // routing through my PHP proxy instead — keeps the key server-side
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
    try {
      return JSON.parse(clean);
    } catch (e) {
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Failed to parse AI response');
    }
  }

  // main entry — using the key directly if provided, falling back to the proxy otherwise
  async function analyze(csvText, apiKey = null) {
    if (apiKey && apiKey.trim().length > 10) {
      return callDirect(csvText, apiKey.trim());
    }
    return callProxy(csvText);
  }

  return { analyze, buildPrompt };
})();

if (typeof module !== 'undefined') module.exports = FinSiteAPI;
