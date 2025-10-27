(function(){
  const $  = sel => document.querySelector(sel);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // ---- Auth guard ----
  const token = localStorage.getItem("qp_token");
  if (!token) {
    window.location.href = "./admin-login.html";
    return;
  }

  // attach Authorization header for admin-only backend routes
  function authHeaders(json=false){
    const h = { "Authorization": "Bearer " + token };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  async function jgetAuth(url){
    const r = await fetch(url, { headers: authHeaders() });
    if (r.status === 401 || r.status === 403) {
      alert("Not authorized. Admin only.");
      localStorage.removeItem("qp_token");
      window.location.href = "./admin-login.html";
      return { ok:false, error:"unauthorized" };
    }
    return r.json();
  }

  async function jpostAuth(url, body){
    const r = await fetch(url, {
      method:"POST",
      headers: authHeaders(true),
      body: JSON.stringify(body || {})
    });
    if (r.status === 401 || r.status === 403) {
      alert("Not authorized. Admin only.");
      localStorage.removeItem("qp_token");
      window.location.href = "./admin-login.html";
      return { ok:false, error:"unauthorized" };
    }
    return r.json();
  }

  // ---- Logout ----
  $('#adminLogoutBtn')?.addEventListener("click", ()=>{
    localStorage.removeItem("qp_token");
    window.location.href = "./admin-login.html";
  });

  // ---- Footer year ----
  const yearNowEl = $('#yearNow');
  if (yearNowEl) yearNowEl.textContent = new Date().getFullYear();

  // =========================================================
  // TAB SWITCHING
  // =========================================================
  $$(".admin-tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const tabId = btn.getAttribute("data-tab");

      // set active state
      $$(".admin-tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      // show the tab section
      $$(".admin-tab-section").forEach(sec=>{
        if (sec.id === tabId) sec.classList.remove("hidden");
        else sec.classList.add("hidden");
      });
    });
  });


  // =========================================================
  // LOAD: Overview KPIs  (/admin/overview)
  // =========================================================
  async function loadOverviewKPIs(){
    const data = await jgetAuth("/admin/overview");
    if (!data || !data.ok) return;

    const sum = data.dailySummary || {};

    $('#ovClosedTrades') && ($('#ovClosedTrades').textContent =
      sum.closedTrades != null ? sum.closedTrades : "--");

    $('#ovWinLoss') && ($('#ovWinLoss').textContent =
      `Wins/Losses: ${sum.wins ?? "--"}/${sum.losses ?? "--"}`);

    const pnlAbs = sum.grossPnLAbs ?? 0;
    if ($('#ovPnL')) {
      $('#ovPnL').textContent = "₹" + Number(pnlAbs).toFixed(2);
      $('#ovPnL').style.color = pnlAbs >= 0 ? "#13c27a" : "#ff5f5f";
    }

    if ($('#ovBestTrade')) {
      if (sum.bestTrade) {
        $('#ovBestTrade').textContent =
          `Best Trade: ${sum.bestTrade.symbol} (₹${Number(sum.bestTrade.pnlAbs||0).toFixed(2)})`;
      } else {
        $('#ovBestTrade').textContent = "Best Trade: --";
      }
    }

    $('#ovOpenTrades') && ($('#ovOpenTrades').textContent = data.openTradesCount ?? "--");
    $('#ovAutoUsers') && ($('#ovAutoUsers').textContent = data.autoUsersCount ?? "--");
  }


  // =========================================================
  // LOAD: Live Signals (/admin/signals)
  // =========================================================
  async function loadSignals(){
    const resp = await jgetAuth("/admin/signals");
    const body = $('#adminSignalsTbody');
    if (!body) return;

    body.innerHTML = "";

    if (!resp || !resp.ok){
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;">No data / error</td></tr>`;
      return;
    }

    const actionable = (resp.data || []).filter(r => r.inEntryZone);

    if (!actionable.length){
      body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:20px;">No active entries</td></tr>`;
      return;
    }

    actionable.forEach(sig=>{
      const entry = Number(sig.ltp || 0);
      const target = entry ? (entry * (1 + 1.5/100)) : 0;
      const stop   = entry ? (entry * (1 - 0.75/100)) : 0;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="admin-user-name">${sig.symbol}</div>
          <div class="note-small">Momentum watch</div>
        </td>
        <td>₹${entry ? entry.toFixed(2) : "--"}</td>
        <td>₹${target ? target.toFixed(2) : "--"}</td>
        <td>₹${stop ? stop.toFixed(2) : "--"}</td>
        <td>
          <div class="note-small">
            Entry zone logic satisfied
          </div>
        </td>
      `;
      body.appendChild(tr);
    });
  }


  // =========================================================
  // LOAD: Trades (/admin/trades)
  // =========================================================
  async function loadTrades(){
    const resp = await jgetAuth("/admin/trades");
    const body = $('#adminTradesTbody');
    if (!body) return;

    body.innerHTML = "";

    if (!resp || !resp.ok){
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;">No data / error</td></tr>`;
      return;
    }

    const trades = resp.trades || [];
    if (!trades.length){
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;">No trades</td></tr>`;
      return;
    }

    trades.forEach(t=>{
      const tr = document.createElement("tr");

      const pnlDisplay = (t.status === "CLOSED")
        ? ("₹" + Number(t.pnlAbs || 0).toFixed(2))
        : "--";

      tr.innerHTML = `
        <td>
          <div class="admin-user-name">${t.symbol}</div>
          <div class="note-small">${t.side || "LONG"}</div>
        </td>
        <td>${t.qty}</td>
        <td>₹${Number(t.entryPrice).toFixed(2)}</td>
        <td>₹${Number(t.targetPrice).toFixed(2)}</td>
        <td>₹${Number(t.stopPrice).toFixed(2)}</td>
        <td>${t.status}</td>
        <td>${pnlDisplay}</td>
      `;
      body.appendChild(tr);
    });
  }


  // =========================================================
  // LOAD: Users (/admin/users)
  // attach actions
  // =========================================================
  async function loadUsers(){
    const resp = await jgetAuth("/admin/users");
    const body = $('#adminUsersTbody');
    if (!body) return;

    body.innerHTML = "";

    if (!resp || !resp.ok || !Array.isArray(resp.users)){
      body.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:20px;">Error loading users</td></tr>`;
      return;
    }

    resp.users.forEach(user=>{
      const tr = document.createElement("tr");

      let planClass = "";
      if (user.plan === "paid") planClass = "plan-paid";
      else if (user.plan === "admin") planClass = "plan-admin";

      const brokerConnected = user.broker?.connected;
      const brokerName = user.broker?.brokerName || "";
      const brokerClass = brokerConnected ? "broker-on" : "broker-off";
      const brokerText = brokerConnected ? (brokerName || "Connected") : "Not Connected";

      const autoClass = user.autoTradingEnabled ? "auto-on" : "auto-off";
      const autoText = user.autoTradingEnabled ? "ON" : "OFF";

      const created = user.createdAt
        ? new Date(user.createdAt).toLocaleString()
        : "--";

      tr.innerHTML = `
        <td>
          <div class="admin-user-name">${user.name || "(no name)"}</div>
        </td>

        <td>
          <div class="admin-user-email">${user.email || "--"}</div>
        </td>

        <td>
          <span class="admin-pill ${planClass}">${user.plan}</span>
        </td>

        <td>
          <span class="admin-pill ${brokerClass}">${brokerText}</span>
        </td>

        <td>
          <span class="admin-pill ${autoClass}">${autoText}</span>
        </td>

        <td>
          <div class="admin-user-email">${created}</div>
        </td>

        <td>
          <div class="admin-row-actions">
            <button class="admin-mini-btn pay"
              data-action="makePaid"
              data-id="${user._id}">
              Paid
            </button>

            <button class="admin-mini-btn"
              data-action="makeTrial"
              data-id="${user._id}">
              Trial
            </button>

            <button class="admin-mini-btn"
              data-action="makeAdmin"
              data-id="${user._id}">
              Admin
            </button>

            <button class="admin-mini-btn danger"
              data-action="toggleAuto"
              data-id="${user._id}"
              data-auto="${user.autoTradingEnabled}">
              ${user.autoTradingEnabled ? "Auto OFF" : "Auto ON"}
            </button>
          </div>
        </td>
      `;

      body.appendChild(tr);
    });

    body.querySelectorAll("button[data-action]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const action = btn.getAttribute("data-action");
        const uid    = btn.getAttribute("data-id");
        if (!uid) return;

        if (action === "makePaid") {
          const r = await jpostAuth("/admin/user/plan", { userId: uid, plan: "paid" });
          if (!r.ok) { alert(r.error || "Failed"); return; }
          await loadUsers();
          await loadOverviewKPIs();
          return;
        }

        if (action === "makeTrial") {
          const r = await jpostAuth("/admin/user/plan", { userId: uid, plan: "trial" });
          if (!r.ok) { alert(r.error || "Failed"); return; }
          await loadUsers();
          await loadOverviewKPIs();
          return;
        }

        if (action === "makeAdmin") {
          const r = await jpostAuth("/admin/user/plan", { userId: uid, plan: "admin" });
          if (!r.ok) { alert(r.error || "Failed"); return; }
          await loadUsers();
          await loadOverviewKPIs();
          return;
        }

        if (action === "toggleAuto") {
          const cur = btn.getAttribute("data-auto") === "true";
          const r = await jpostAuth("/admin/user/automation", { userId: uid, enable: !cur });
          if (!r.ok) { alert(r.error || "Failed"); return; }
          await loadUsers();
          await loadOverviewKPIs();
          return;
        }
      });
    });
  }


  // =========================================================
  // LOAD: System settings (/admin/system)
  // and allow toggles
  // =========================================================
  async function loadSystem(){
    const resp = await jgetAuth("/admin/system");
    const body = $('#adminSystemTbody');
    if (!body) return;

    body.innerHTML = "";

    if (!resp || !resp.ok || !resp.settings){
      body.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;">Error loading system flags</td></tr>`;
      return;
    }

    const s = resp.settings;

    const rows = [
      {
        key: "isPaperTradingActive",
        title: "Paper Trading Engine",
        desc: "If OFF, engine will STOP simulating new paper trades.",
        val: s.isPaperTradingActive
      },
      {
        key: "isLiveExecutionAllowed",
        title: "Allow Live Execution For Paid Users",
        desc: "If ON, paid users *may* place real trades (still gated by their auto toggle + broker connection).",
        val: s.isLiveExecutionAllowed
      },
      {
        key: "marketHalt",
        title: "Emergency Halt",
        desc: "If ON, system should NOT enter any new position of any kind.",
        val: s.marketHalt
      }
    ];

    rows.forEach(row=>{
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>
          <div class="admin-user-name">${row.title}</div>
        </td>

        <td>
          <span class="admin-pill ${row.val ? 'auto-on' : 'auto-off'}">
            ${row.val ? "ON" : "OFF"}
          </span>
        </td>

        <td>
          <div class="note-small">${row.desc}</div>
        </td>

        <td>
          <button class="admin-mini-btn sys"
            data-action="toggleSystem"
            data-key="${row.key}"
            data-val="${row.val ? "true":"false"}">
            ${row.val ? "Turn OFF" : "Turn ON"}
          </button>
        </td>
      `;
      body.appendChild(tr);
    });

    // action binding
    body.querySelectorAll("button[data-action='toggleSystem']").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const key = btn.getAttribute("data-key");
        const current = btn.getAttribute("data-val")==="true";
        const r = await jpostAuth("/admin/system", {
          key,
          value: !current
        });
        if (!r.ok){
          alert(r.error || "Failed to update setting");
          return;
        }
        await loadSystem();
        await loadOverviewKPIs();
      });
    });
  }


  // =========================================================
  // FYERS BROKER CONNECT (System Control tab)
  // =========================================================

  async function fyersStatus() {
    const r = await fetch("/fyers/status", {
      headers: authHeaders()
    });
    if (!r.ok) {
      return { ok: false, error: "status fetch failed" };
    }
    return r.json();
  }

  async function fyersGetLoginUrl() {
    const r = await fetch("/fyers/login-url", {
      headers: authHeaders()
    });
    if (!r.ok) {
      return { ok: false, error: "login-url failed" };
    }
    return r.json();
  }

  async function fyersExchangeCode(authCode) {
    const r = await fetch("/fyers/exchange", {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ auth_code: authCode })
    });
    if (!r.ok) {
      return { ok: false, error: "exchange failed" };
    }
    return r.json();
  }

  async function renderFyersStatus() {
    const statusTextEl = document.getElementById("fyersStatusText");
    const metaEl       = document.getElementById("fyersTokenMeta");

    if (!statusTextEl || !metaEl) return;

    statusTextEl.textContent = "Checking…";
    statusTextEl.classList.remove("broker-status-on","broker-status-off");
    statusTextEl.classList.add("broker-status-off");

    const resp = await fyersStatus();
    if (!resp.ok) {
      statusTextEl.textContent = "ERROR";
      metaEl.textContent = resp.error || "Cannot fetch broker status";
      return;
    }

    if (resp.hasRefresh) {
      statusTextEl.textContent = "CONNECTED";
      statusTextEl.classList.remove("broker-status-off");
      statusTextEl.classList.add("broker-status-on");

      const createdAt = resp.tokenCreatedAt
        ? new Date(resp.tokenCreatedAt).toLocaleString()
        : "--";

      metaEl.textContent = `Access: ${resp.hasAccess ? "OK" : "No"} | Since: ${createdAt}`;
    } else {
      statusTextEl.textContent = "NOT LINKED";
      statusTextEl.classList.remove("broker-status-on");
      statusTextEl.classList.add("broker-status-off");
      metaEl.textContent = "No refresh_token stored yet. Complete Step 1 & Step 2.";
    }
  }

  function wireFyersUI() {
    const btnStatus   = document.getElementById("fyersStatusReloadBtn");
    const btnGetUrl   = document.getElementById("btnGetLoginUrl");
    const btnOpenUrl  = document.getElementById("btnOpenLoginUrl");
    const btnExchange = document.getElementById("btnExchangeCode");

    const urlInput   = document.getElementById("fyersLoginUrl");
    const codeInput  = document.getElementById("fyersAuthCodeInput");
    const resultBox  = document.getElementById("fyersExchangeResult");

    if (btnStatus) {
      btnStatus.addEventListener("click", async () => {
        await renderFyersStatus();
      });
    }

    if (btnGetUrl && urlInput) {
      btnGetUrl.addEventListener("click", async () => {
        urlInput.value = "Loading...";
        const data = await fyersGetLoginUrl();
        if (!data.ok) {
          urlInput.value = "ERROR";
          return;
        }
        urlInput.value = data.url || "";
      });
    }

    if (btnOpenUrl && urlInput) {
      btnOpenUrl.addEventListener("click", () => {
        if (!urlInput.value) {
          alert("Generate URL first");
          return;
        }
        window.open(urlInput.value, "_blank");
      });
    }

    if (btnExchange && codeInput && resultBox) {
      btnExchange.addEventListener("click", async () => {
        const code = codeInput.value.trim();
        if (!code) {
          alert("Paste auth_code first");
          return;
        }
        resultBox.style.color = "#4e6bff";
        resultBox.textContent = "Exchanging...";

        const data = await fyersExchangeCode(code);

        if (!data.ok) {
          resultBox.style.color = "#ff5f5f";
          resultBox.textContent = "Failed: " + (data.error || "unknown error");
          return;
        }

        resultBox.style.color = "#13c27a";
        resultBox.textContent = "Success. Tokens saved.";

        await renderFyersStatus();
      });
    }
  }


  // =========================================================
  // REFRESH BUTTONS per-section
  // =========================================================
  $$(".admin-refresh-btn").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const type = btn.getAttribute("data-reload");
      if (type === "signals")      await loadSignals();
      else if (type === "trades")  await loadTrades();
      else if (type === "users")   await loadUsers();
      else if (type === "system")  await loadSystem();
      else {
        await loadOverviewKPIs();
        await loadSignals();
        await loadTrades();
        await loadUsers();
        await loadSystem();
      }
    });
  });


  // =========================================================
  // INITIAL LOAD + POLLING + FYERS INIT
  // =========================================================
  async function initialLoad(){
    await loadOverviewKPIs();
    await loadSignals();
    await loadTrades();
    await loadUsers();
    await loadSystem();

    wireFyersUI();
    await renderFyersStatus();
  }

  initialLoad();

  // Poll live data every 30s (overview/signals/trades only)
  setInterval(()=>{
    loadOverviewKPIs();
    loadSignals();
    loadTrades();
  }, 30000);

})(); // END IIFE
