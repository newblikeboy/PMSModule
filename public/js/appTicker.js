
(function(){
  const trackEl = document.getElementById("tickerTrack");

  // 1. Symbols you want to watch. You can load from backend later.
  // Keep this list liquid/high-impact names (index movers, F&O names, etc.)
  const watchlistSymbols = [
    "RELIANCE",
    "HDFCBANK",
    "ICICIBANK",
    "INFY",
    "TCS",
    "TATASTEEL",
    "SBIN",
    "ITC",
    "KOTAKBANK",
    "AXISBANK",
    "LT",
    "MARUTI",
    "HINDUNILVR",
    "BHARTIARTL",
    "NTPC",
    "ONGC",
    "TITAN",
    "BAJFINANCE",
    "NESTLEIND",
    "ULTRACEMCO"
  ];

  // 2. helper: format to 2 decimals
  function fmt(n){
    if (n === null || n === undefined || Number.isNaN(+n)) return "--";
    return Number(n).toFixed(2);
  }

  // 3. build ticker DOM from quotes data
  function renderTicker(quotes){
    if (!trackEl) return;

    // Build one loop worth of items
    const rowFrag = document.createDocumentFragment();

    quotes.forEach(q => {
      const wrap = document.createElement("div");
      wrap.className = "ticker-item";

      const changePct = q.changePercent || 0;
      let dirClass = "flat";
      if (changePct > 0) dirClass = "up";
      else if (changePct < 0) dirClass = "down";

      wrap.innerHTML = `
        <div class="ticker-symbol">${q.symbol}</div>
        <div class="ticker-price">₹${fmt(q.ltp)}</div>
        <div class="ticker-change ${dirClass}">
          ${changePct > 0 ? "+" : ""}${fmt(changePct)}%
        </div>
      `;

      rowFrag.appendChild(wrap);
    });

    // Clear previous
    trackEl.innerHTML = "";

    // We append the items TWICE back-to-back to simulate infinite loop
    // [A...A] [A...A] so when we animate -50%, it lines up seamlessly
    trackEl.appendChild(rowFrag.cloneNode(true));
    trackEl.appendChild(rowFrag.cloneNode(true));
  }

  // 4. fetch live quotes from backend (preferred)
  async function fetchQuotesFromAPI() {
    try {
      // EXAMPLE backend endpoint you can implement:
      // GET /market/quotes?symbols=RELIANCE,HDFCBANK,...
      //
      // Expected JSON format:
      // {
      //   ok: true,
      //   data: [
      //     { symbol:"RELIANCE", ltp:2751.35, changePercent:1.24 },
      //     ...
      //   ]
      // }
      const url = "/market/quotes?symbols=" + encodeURIComponent(watchlistSymbols.join(","));
      const r = await fetch(url);
      if (!r.ok) throw new Error("HTTP " + r.status);

      const data = await r.json();
      if (!data.ok || !Array.isArray(data.data)) {
        throw new Error("Bad payload");
      }

      return data.data;
    } catch (err) {
      console.warn("Falling back to demo quotes:", err.message);

      // Fallback mock data so UI still works visually
      // You can delete this block once your real API works
      return [
        { symbol:"RELIANCE",     ltp:2751.35, changePercent:+1.24 },
        { symbol:"HDFCBANK",     ltp:1515.90, changePercent:-0.42 },
        { symbol:"ICICIBANK",    ltp:1124.10, changePercent:+0.75 },
        { symbol:"INFY",         ltp:1521.60, changePercent:+0.30 },
        { symbol:"TCS",          ltp:3852.25, changePercent:-0.18 },
        { symbol:"SBIN",         ltp:842.00,  changePercent:+2.10 },
        { symbol:"ITC",          ltp:452.80,  changePercent:+0.05 },
        { symbol:"KOTAKBANK",    ltp:1825.40, changePercent:-1.12 },
        { symbol:"AXISBANK",     ltp:1211.55, changePercent:+0.92 },
        { symbol:"LT",           ltp:3705.00, changePercent:+1.88 },
        { symbol:"MARUTI",       ltp:11850.5, changePercent:+0.64 },
        { symbol:"BHARTIARTL",   ltp:1421.30, changePercent:+0.22 },
        { symbol:"TATASTEEL",    ltp:171.40,  changePercent:+3.10 },
        { symbol:"HINDUNILVR",   ltp:2522.00, changePercent:-0.55 },
        { symbol:"BAJFINANCE",   ltp:7250.90, changePercent:+0.11 },
      ];
    }
  }

  // 5. initial load
  async function initTicker(){
    const quotes = await fetchQuotesFromAPI();
    renderTicker(quotes);
  }

  // 6. periodic refresh
  // fetch fresh quotes every 20s and rebuild
  setInterval(async ()=>{
    const quotes = await fetchQuotesFromAPI();
    renderTicker(quotes);
  }, 20000);

  // run now
  initTicker();

})();

