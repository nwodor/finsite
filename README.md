# FinSite — AI Finance Analyzer

upload your bank statement and get a real breakdown of where your money is going. powered by claude AI, takes about 10 seconds.

works with CSV, Excel, PDF, and Word exports from any bank.

---

## what it does

- breaks your spending into categories
- gives you a financial health score (0–100)
- calls out what you're wasting money on
- tells you where you can actually save
- suggests investments based on your situation

---

## file structure

```
finsite/
├── index.html          - the main page (upload + landing)
├── css/
│   ├── main.css        - base styles, colors, fonts, animations
│   ├── components.css  - buttons, cards, inputs, badges
│   └── dashboard.css   - sidebar, layout, the full dashboard UI
├── js/
│   ├── api.js          - sends the statement to claude, gets back the analysis
│   ├── upload.js       - handles file drops, clicks, parsing PDFs/Excel/etc
│   └── app.js          - controls the whole app, renders the dashboard
└── php/
    ├── config.php      - your API key goes here (gitignored)
    └── analyze.php     - server-side proxy so the key never hits the browser
```

---

## running it locally

just open `index.html` in your browser. the API key is already embedded and paid for so you don't need to enter anything — just upload a statement and hit analyze.

if you're running it on a server with PHP, the proxy in `php/analyze.php` will handle everything server-side automatically.

---

## getting an API key

go to [console.anthropic.com](https://console.anthropic.com), make an account, generate a key. costs around $0.05 per analysis so $5 will last you a while.

---

## security

- `php/config.php` and `js/config.local.js` are both gitignored 
- everything runs in memory, nothing gets saved or logged

---

## stack

vanilla HTML, CSS, and JS on the front end. PHP for the proxy. Claude Sonnet for the AI. no frameworks.

---

## what's next

- [ ] user accounts + login
- [ ] save reports to a database, compare month over month
- [ ] PDF export of the report
- [ ] budget goal tracking
- [ ] multi-currency support
