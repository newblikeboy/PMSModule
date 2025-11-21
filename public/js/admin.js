(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // -------------------------------
  // Auth guard
  // -------------------------------
  const token = localStorage.getItem("qp_token");
  if (!token) {
    window.location.href = "./admin-login.html";
    return;
  }

  const authHeaders = (json = false) => {
    const headers = { Authorization: "Bearer " + token };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  };

  async function jgetAuth(url) {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      alert("Not authorized. Admin only.");
      localStorage.removeItem("qp_token");
      window.location.href = "./admin-login.html";
      return { ok: false };
    }

    const ct = res.headers.get('content-type') || '';
    if (!res.ok) {
      if (ct.includes('application/json')) return await res.json();
      const txt = await res.text();
      return { ok: false, error: txt };
    }

    if (ct.includes('application/json')) return await res.json();
    return { ok: true, data: await res.text() };
  }

  async function jpostAuth(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(body || {})
    });
    if (res.status === 401 || res.status === 403) {
      alert("Not authorized. Admin only.");
      localStorage.removeItem("qp_token");
      window.location.href = "./admin-login.html";
      return { ok: false };
    }
    const ct = res.headers.get('content-type') || '';
    if (!res.ok) {
      if (ct.includes('application/json')) return await res.json();
      const txt = await res.text();
      return { ok: false, error: txt };
    }
    if (ct.includes('application/json')) return await res.json();
    return { ok: true, data: await res.text() };
  }

  // -------------------------------
  // UI basics
  // -------------------------------
  $("#adminLogoutBtn")?.addEventListener("click", () => {
    localStorage.removeItem("qp_token");
    window.location.href = "./admin-login.html";
  });

  const yearNowEl = $("#yearNow");
  if (yearNowEl) yearNowEl.textContent = new Date().getFullYear();

  const switchTab = (tabId, opts = {}) => {
    const targetBtn = $(`.admin-tab-btn[data-tab="${tabId}"]`);
    if (!targetBtn) return;
    $$(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
    targetBtn.classList.add("active");
    $$(".admin-tab-section").forEach((sec) => {
      if (sec.id === tabId) sec.classList.remove("hidden");
      else sec.classList.add("hidden");
    });
    if (!opts.skipScroll) window.scrollTo({ top: 0, behavior: "smooth" });
    try { localStorage.setItem("admin_active_tab", tabId); } catch {}
  };

  $$(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      switchTab(tabId);
    });
  });

  const savedTab = localStorage.getItem("admin_active_tab");
  if (savedTab) {
    switchTab(savedTab, { skipScroll: true });
  } else {
    switchTab("overviewTab", { skipScroll: true });
  }

  const formatCurrency = (val) => {
    const amount = Number(val ?? 0);
    if (Number.isNaN(amount)) return "\u20B90.00";
    return `\u20B9${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "--";
    const date = new Date(Number(ts));
    if (Number.isNaN(date.getTime())) return "--";

    const diffMs = Date.now() - date.getTime();
    if (diffMs < 60_000) return "just now";
    if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)} min ago`;
    if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)} hr ago`;
    return date.toLocaleString();
  };

  const formatExpiry = (createdAt, expiresInSec) => {
    if (!createdAt || !expiresInSec) return "--";
    const expiryTs = Number(createdAt) + Number(expiresInSec) * 1000;
    if (!Number.isFinite(expiryTs)) return "--";
    const expiryDate = new Date(expiryTs);
    if (Number.isNaN(expiryDate.getTime())) return "--";

    const diffMs = expiryDate.getTime() - Date.now();
    const base = expiryDate.toLocaleString();
    if (diffMs <= 0) return `${base} (expired)`;

    const diffMin = Math.round(diffMs / 60_000);
    if (diffMin < 60) return `${base} (${diffMin} min left)`;

    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 48) return `${base} (${diffHr} hr left)`;

    const diffDay = Math.round(diffHr / 24);
    return `${base} (${diffDay} day${diffDay === 1 ? "" : "s"} left)`;
  };

  const setValueState = (el, state) => {
    if (!el) return;
    el.classList.remove("good", "bad");
    if (state === "good") el.classList.add("good");
    if (state === "bad") el.classList.add("bad");
  };

  let cachedUsers = [];

  // -------------------------------
  // Overview KPIs
  // -------------------------------
  async function loadOverview() {
    const data = await jgetAuth("/admin/overview");
    if (!data || !data.ok) return;

    const sum = data.dailySummary || {};
    $("#ovClosedTrades") && ($("#ovClosedTrades").textContent = sum.closedTrades ?? "--");
    $("#ovWinLoss") && ($("#ovWinLoss").textContent = `Wins / Losses: ${sum.wins ?? "--"} / ${sum.losses ?? "--"}`);

    if ($("#ovPnL")) {
      const pnl = Number(sum.grossPnLAbs ?? 0);
      $("#ovPnL").textContent = formatCurrency(pnl);
      $("#ovPnL").style.color = pnl >= 0 ? "#13c27a" : "#ff5f5f";
    }

    if ($("#ovBestTrade")) {
      if (sum.bestTrade) {
        $("#ovBestTrade").textContent =
          `Best trade: ${sum.bestTrade.symbol} (${formatCurrency(sum.bestTrade.pnlAbs ?? 0)})`;
      } else {
        $("#ovBestTrade").textContent = "Best trade: --";
      }
    }

    $("#ovOpenTrades") && ($("#ovOpenTrades").textContent = data.openTradesCount ?? "--");
    $("#ovAutoUsers") && ($("#ovAutoUsers").textContent = data.autoUsersCount ?? "--");
  }

  // -------------------------------
  // Signals table
  // -------------------------------
  async function loadSignals() {
    const resp = await jgetAuth("/admin/signals");
    const body = $("#adminSignalsTbody");
    if (!body) return;

    body.innerHTML = "";
    if (!resp || !resp.ok) {
      body.innerHTML = `<tr><td colspan="3" class="admin-table-placeholder">No data / error</td></tr>`;
      return;
    }

    const signals = resp.signals || resp.data || [];
    if (!signals.length) {
      body.innerHTML = `<tr><td colspan="3" class="admin-table-placeholder">No signals available</td></tr>`;
      return;
    }

    signals.forEach((row) => {
      const tr = document.createElement("tr");
      const zone = row.inEntryZone ? "RSI 40-50" : "Watching";
      const rsi = typeof row.rsi === "number" ? row.rsi.toFixed(2) : "--";

      tr.innerHTML = `
        <td>${row.symbol}</td>
        <td>${zone}</td>
        <td>${rsi}</td>
      `;
      body.appendChild(tr);
    });
  }

  // -------------------------------
  // Trades table
  // -------------------------------
  async function loadTrades() {
    const resp = await jgetAuth("/admin/trades");
    const body = $("#adminTradesTbody");
    if (!body) return;

    body.innerHTML = "";
    if (!resp || !resp.ok) {
      body.innerHTML = `<tr><td colspan="10" class="admin-table-placeholder">No data / error</td></tr>`;
      return;
    }

    const trades = resp.trades || [];
    if (!trades.length) {
      body.innerHTML = `<tr><td colspan="10" class="admin-table-placeholder">No trades yet</td></tr>`;
      return;
    }

    // Get users data for mapping user names
    const usersResp = await jgetAuth("/admin/users");
    const usersMap = {};
    if (usersResp && usersResp.ok) {
      (usersResp.users || []).forEach(user => {
        usersMap[user._id] = user;
      });
    }

    // Get live P&L data for open trades
    let livePnL = { results: [] };
    try {
      const pnlResult = await jgetAuth("/trade/live-pnl");
      if (pnlResult && pnlResult.ok) {
        livePnL = pnlResult;
      }
    } catch (err) {
      console.warn("Failed to load live P&L:", err);
    }

    // Create a map for quick P&L lookup by userId
    const pnlMap = {};
    (livePnL.results || []).forEach(userData => {
      const userId = userData.userId;
      (userData.open || []).forEach(trade => {
        if (!pnlMap[userId]) pnlMap[userId] = {};
        pnlMap[userId][trade._id] = trade;
      });
    });

    trades.forEach((trade) => {
      const user = usersMap[trade.userId] || {};
      const userName = user.name || user.email || "Unknown User";
      const liveData = (pnlMap[trade.userId] && pnlMap[trade.userId][trade._id]) || {};
      const currentPrice = liveData.ltp || trade.currentPrice || trade.entryPrice;
      const pnlAbs = liveData.pnlAbs || trade.pnlAbs || 0;
      const pnlPct = liveData.pnlPct || trade.pnlPct || 0;
      const isProfit = pnlAbs >= 0;
      
      const statusClass = trade.status === 'CLOSED' ? 'status-closed' : 'status-open';
      const actionButton = trade.status === 'OPEN'
        ? `<button class="admin-mini-btn danger" onclick="closeTradeAdmin('${trade._id}')">Close</button>`
        : '--';
      
      const tr = document.createElement("tr");
      // Attach trade id so admin P&L updates match rows reliably
      try { tr.setAttribute('data-tradeid', trade._id); } catch(e) {}
      tr.innerHTML = `
        <td><div class="admin-user-cell">${userName}</div></td>
        <td>${trade.symbol}</td>
        <td>${trade.quantity || trade.qty || "--"}</td>
        <td>${formatCurrency(trade.entryPrice)}</td>
        <td>${formatCurrency(currentPrice)}</td>
        <td>${formatCurrency(trade.targetPrice)}</td>
        <td>${formatCurrency(trade.stopPrice)}</td>
        <td class="${isProfit ? 'pnl-positive' : 'pnl-negative'}">
          ${formatCurrency(pnlAbs)} (${pnlPct.toFixed(2)}%)
        </td>
        <td>
          <span class="admin-pill ${trade.status === 'OPEN' ? 'auto-on' : 'plan-paid'}">${trade.status}</span>
        </td>
        <td>${actionButton}</td>
      `;
      tr.className = statusClass;
      body.appendChild(tr);
    });
  }

  // -------------------------------
  // Users table
  // -------------------------------
  async function loadUsers() {
    const resp = await jgetAuth("/admin/users");
    const body = $("#adminUsersTbody");
    if (!body) return;

    body.innerHTML = "";
    if (!resp || !resp.ok) {
      body.innerHTML = `<tr><td colspan="9" class="admin-table-placeholder">No data / error</td></tr>`;
      cachedUsers = [];
      renderAngelSummary();
      return;
    }

    cachedUsers = resp.users || [];
    if (!cachedUsers.length) {
      body.innerHTML = `<tr><td colspan="9" class="admin-table-placeholder">No users yet</td></tr>`;
      renderAngelSummary();
      return;
    }

    cachedUsers.forEach((user) => {
      const plan = String(user.plan || "Free");
      const role = String(user.role || "User");
      const planIsPaid = plan !== "Free" || role === "Admin";
      const planClass = planIsPaid ? "plan-paid" : "plan-trial";
      const planLabel = role === "Admin" ? "Admin" : plan;

      const brokerConnected = user.broker?.connected;
      const brokerName = user.broker?.brokerName || "Not connected";
      const brokerClass = brokerConnected ? "broker-connected" : "broker-missing";

      const marginPct = Math.round((user.angelAllowedMarginPct ?? 0) * 100);
      const liveEnabled = !!user.angelLiveEnabled;
      const autoEnabled = !!user.autoTradingEnabled;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${user.name || "--"}</td>
        <td><div class="admin-user-email">${user.email || "--"}</div></td>
        <td><span class="admin-pill ${planClass}">${planLabel}</span></td>
        <td><span class="admin-pill ${brokerClass}">${brokerName}</span></td>
        <td><span class="admin-pill">${marginPct}%</span></td>
        <td><span class="admin-pill ${liveEnabled ? "auto-on" : "broker-missing"}">${liveEnabled ? "Live ON" : "Live OFF"}</span></td>
        <td><span class="admin-pill ${autoEnabled ? "auto-on" : "auto-off"}">${autoEnabled ? "Auto ON" : "Auto OFF"}</span></td>
        <td>${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "--"}</td>
        <td>
          <div class="admin-row-actions">
            <button class="admin-mini-btn pay" data-action="plan-Monthly" data-id="${user._id}">Monthly</button>
            <button class="admin-mini-btn" data-action="plan-Free" data-id="${user._id}">Free</button>
            <button class="admin-mini-btn" data-action="plan-admin" data-id="${user._id}">Admin</button>
            <button class="admin-mini-btn" data-action="angel-login" data-id="${user._id}">Angel Login</button>
            <button class="admin-mini-btn" data-action="angel-margin" data-id="${user._id}" data-margin="${marginPct}">Set Margin</button>
            <button class="admin-mini-btn" data-action="angel-live" data-id="${user._id}" data-live="${liveEnabled}">${liveEnabled ? "Disable Live" : "Enable Live"}</button>
            <button class="admin-mini-btn" data-action="auto-toggle" data-id="${user._id}" data-auto="${autoEnabled}">${autoEnabled ? "Auto OFF" : "Auto ON"}</button>
          </div>
        </td>
      `;
      body.appendChild(tr);
    });

    body.querySelectorAll("button[data-action]").forEach((btn) => {
      btn.addEventListener("click", handleUserAction);
    });

    renderAngelSummary();
  }

  async function handleUserAction(evt) {
    const btn = evt.currentTarget;
    const action = btn.getAttribute("data-action");
    const userId = btn.getAttribute("data-id");
    if (!userId) return;

    if (action === "plan-Monthly" || action === "plan-Free" || action === "plan-admin") {
      const plan = action.replace("plan-", "");
      const resp = await jpostAuth("/admin/user/plan", { userId, plan });
      if (!resp.ok) {
        alert(resp.error || "Failed to update plan");
        return;
      }
      await loadUsers();
      return;
    }

    if (action === "auto-toggle") {
      const current = btn.getAttribute("data-auto") === "true";
      const resp = await jpostAuth("/admin/user/automation", { userId, enable: !current });
      if (!resp.ok) {
        alert(resp.error || "Failed to update automation");
        return;
      }
      await loadUsers();
      return;
    }

    if (action === "angel-margin") {
      const current = Number(btn.getAttribute("data-margin") || 50);
      const value = prompt("Set Angel margin percentage (0 - 100):", current);
      if (value === null) return;
      const pct = Number(value);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        alert("Enter a value between 0 and 100.");
        return;
      }
      const resp = await jpostAuth("/admin/user/angel", {
        userId,
        allowedMarginPercent: pct
      });
      if (!resp.ok) {
        alert(resp.error || "Failed to update margin");
        return;
      }
      await loadUsers();
      return;
    }

    if (action === "angel-live") {
      const current = btn.getAttribute("data-live") === "true";
      const resp = await jpostAuth("/admin/user/angel", {
        userId,
        liveEnabled: !current
      });
      if (!resp.ok) {
        alert(resp.error || "Failed to update live flag");
        return;
      }
      await loadUsers();
      return;
    }

    if (action === "angel-login") {
      const data = await jgetAuth(`/admin/angel/login-link?userId=${encodeURIComponent(userId)}`);
      if (!data || !data.ok) {
        alert(data.error || "Failed to generate login link");
        return;
      }
      window.open(data.url, "_blank", "width=520,height=680");
      return;
    }
  }

  // -------------------------------
  // System settings table
  // -------------------------------
  async function loadSystem() {
    const resp = await jgetAuth("/admin/system");
    const body = $("#adminSystemTbody");
    if (!body) return;

    body.innerHTML = "";
    if (!resp || !resp.ok) {
      body.innerHTML = `<tr><td colspan="4" class="admin-table-placeholder">No data / error</td></tr>`;
      return;
    }

    const settings = resp.settings || {};
    const keys = Object.keys(settings);
    if (!keys.length) {
      body.innerHTML = `<tr><td colspan="4" class="admin-table-placeholder">No settings tracked</td></tr>`;
      return;
    }

    keys.forEach((key) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${key}</td>
        <td>${String(settings[key])}</td>
        <td>--</td>
        <td>${new Date().toLocaleTimeString()}</td>
      `;
      body.appendChild(tr);
    });
  }

  // -------------------------------
  // Engine status
  // -------------------------------
  async function renderEngineStatus() {
    const resp = await jgetAuth("/admin/engine/status");
    if (!resp || !resp.ok) return;

    const pill = $("#engineStatusPill");
    if (pill) {
      const running = resp.running;
      pill.textContent = running ? "ON" : "OFF";
      pill.classList.toggle("pill-on", running);
      pill.classList.toggle("pill-off", !running);
    }
    $("#engineBeforeCutoff") && ($("#engineBeforeCutoff").textContent = resp.beforeCutoff ?? "--");
    $("#engineLastError") && ($("#engineLastError").textContent = resp.lastError || "None");
  }

  $("#btnEngineStart")?.addEventListener("click", async () => {
    await jpostAuth("/admin/engine/start", {});
    await renderEngineStatus();
  });

  $("#btnEngineStop")?.addEventListener("click", async () => {
    await jpostAuth("/admin/engine/stop", {});
    await renderEngineStatus();
  });

  // -------------------------------
  // Fyers token monitor
  // -------------------------------
  async function loadFyersStatus(opts = {}) {
    const { quiet } = opts || {};
    const msg = $("#fyersStatusMsg");
    if (!quiet && msg) {
      msg.textContent = "Checking broker token status...";
      msg.style.color = "var(--admin-text-soft)";
    }

    try {
      const data = await jgetAuth("/fyers/status");
      if (!data || data.ok === false) {
        throw new Error(data?.error || "Unable to fetch status");
      }

      const accessEl = $("#fyersAccessState");
      const refreshEl = $("#fyersRefreshState");
      const issuedEl = $("#fyersTokenIssued");
      const expiryEl = $("#fyersTokenExpiry");
      const autoEl = $("#fyersAutoRefresh");
      const manualEl = $("#fyersManualRefresh");

      if (accessEl) {
        accessEl.textContent = data.access_token_present ? "Saved" : "Missing";
        setValueState(accessEl, data.access_token_present ? "good" : "bad");
      }
      if (refreshEl) {
        refreshEl.textContent = data.refresh_token_present ? "Saved" : "Missing";
        setValueState(refreshEl, data.refresh_token_present ? "good" : "bad");
      }
      if (issuedEl) {
        issuedEl.textContent = formatTimestamp(data.created_at);
      }
      if (expiryEl) {
        expiryEl.textContent = formatExpiry(data.created_at, data.expires_in);
      }
      if (autoEl) {
        autoEl.textContent = formatTimestamp(data.last_auto_refresh_at);
      }
      if (manualEl) {
        manualEl.textContent = formatTimestamp(data.last_manual_refresh_at);
      }

      if (!quiet && msg) {
        const ts = new Date().toLocaleTimeString();
        msg.textContent = `Status updated at ${ts}`;
        msg.style.color = "var(--admin-text-soft)";
      }
    } catch (err) {
      if (msg) {
        msg.textContent = err?.message || "Unable to load token status";
        msg.style.color = "#ff5f5f";
      }
    }
  }

  async function forceRefreshFyers() {
    const msg = $("#fyersStatusMsg");
    if (msg) {
      msg.textContent = "Forcing refresh...";
      msg.style.color = "var(--admin-text-soft)";
    }

    try {
      const resp = await jpostAuth("/fyers/force-refresh", {});
      if (!resp || resp.ok === false) {
        throw new Error(resp?.error || "Refresh failed");
      }
      if (msg) {
        msg.textContent = "Manual refresh complete. New tokens saved.";
        msg.style.color = "#13c27a";
      }
      await loadFyersStatus({ quiet: true });
    } catch (err) {
      if (msg) {
        msg.textContent = err?.message || "Unable to refresh token";
        msg.style.color = "#ff5f5f";
      }
    }
  }

  async function openFyersLoginFlow() {
    const msg = $("#fyersStatusMsg");
    if (msg) {
      msg.textContent = "Requesting broker login URL...";
      msg.style.color = "var(--admin-text-soft)";
    }
    try {
      const resp = await jgetAuth("/fyers/login-url");
      if (!resp || resp.ok === false || !resp.url) {
        throw new Error(resp?.error || "Unable to start login flow");
      }
      window.open(resp.url, "_blank", "width=520,height=680");
      if (msg) {
        msg.textContent = "Login window opened. Complete OTP + approve, then run Check Status.";
        msg.style.color = "#13c27a";
      }
    } catch (err) {
      if (msg) {
        msg.textContent = err?.message || "Unable to open login flow";
        msg.style.color = "#ff5f5f";
      }
    }
  }

  async function exchangeFyersAuthCode() {
    const input = $("#fyersAuthCodeInput");
    const msg = $("#fyersStatusMsg");
    if (!input || !msg) return;

    const authCode = input.value.trim();
    if (!authCode) {
      msg.textContent = "Enter the auth_code first.";
      msg.style.color = "#ff5f5f";
      return;
    }

    msg.textContent = "Exchanging auth_code for tokens...";
    msg.style.color = "var(--admin-text-soft)";

    try {
      const resp = await jpostAuth("/fyers/exchange", { auth_code: authCode });
      if (!resp || resp.ok === false) {
        throw new Error(resp?.error || "Exchange failed");
      }
      input.value = ""; // Clear input on success
      msg.textContent = "Auth code exchanged successfully. Tokens saved.";
      msg.style.color = "#13c27a";
      await loadFyersStatus({ quiet: true });
    } catch (err) {
      msg.textContent = err?.message || "Unable to exchange auth_code";
      msg.style.color = "#ff5f5f";
    }
  }

  $("#fyersStatusReloadBtn")?.addEventListener("click", () => loadFyersStatus());
  $("#fyersForceRefreshBtn")?.addEventListener("click", forceRefreshFyers);
  $("#fyersLoginBtn")?.addEventListener("click", openFyersLoginFlow);
  $("#fyersExchangeBtn")?.addEventListener("click", exchangeFyersAuthCode);

  // -------------------------------
  // Angel summary
  // -------------------------------
  function renderAngelSummary() {
    const linked = cachedUsers.filter((u) => u.broker?.connected && u.broker?.brokerName === "ANGEL");
    const live = cachedUsers.filter((u) => u.angelLiveEnabled);
    const marginValues = linked
      .map((u) => Number(u.angelAllowedMarginPct ?? 0))
      .filter((val) => Number.isFinite(val));

    const avgMargin = marginValues.length
      ? Math.round((marginValues.reduce((sum, val) => sum + val, 0) / marginValues.length) * 100)
      : 0;

    $("#angelLinkedUsers") && ($("#angelLinkedUsers").textContent = linked.length);
    $("#angelLiveUsers") && ($("#angelLiveUsers").textContent = live.length);
    $("#angelAvgMargin") && ($("#angelAvgMargin").textContent = marginValues.length ? `${avgMargin}%` : "--");
  }

  $("#angelRefreshSummaryBtn")?.addEventListener("click", () => {
    renderAngelSummary();
    const ts = new Date().toLocaleTimeString();
    $("#angelSummaryMsg") && ($("#angelSummaryMsg").textContent = `Summary refreshed at ${ts}`);
  });

  // -------------------------------
  // Angel login assistant
  // -------------------------------
  async function generateAngelLink() {
    const input = $("#angelAssistUser");
    const msg = $("#angelAssistMsg");
    const linkBox = $("#angelLoginLink");
    if (!input || !msg || !linkBox) return;

    const raw = input.value.trim();
    if (!raw) {
      msg.textContent = "Enter a user ID or email first.";
      msg.style.color = "#ff5f5f";
      return;
    }

    msg.textContent = "Generating...";
    msg.style.color = "var(--admin-text-soft)";

    const query = raw.includes("@")
      ? `?email=${encodeURIComponent(raw)}`
      : `?userId=${encodeURIComponent(raw)}`;

    const data = await jgetAuth(`/admin/angel/login-link${query}`);
    if (!data || !data.ok) {
      msg.textContent = data.error || "Unable to build login link";
      msg.style.color = "#ff5f5f";
      return;
    }

    linkBox.value = data.url;
    msg.textContent = "Login link generated. Share securely.";
    msg.style.color = "#13c27a";
  }

  $("#angelGenerateLoginBtn")?.addEventListener("click", generateAngelLink);
  $("#angelLaunchLoginBtn")?.addEventListener("click", () => {
    const link = $("#angelLoginLink")?.value?.trim();
    if (!link) {
      alert("Generate a login link first.");
      return;
    }
    window.open(link, "_blank", "width=520,height=680");
  });
  $("#angelStatusReloadBtn")?.addEventListener("click", loadUsers);

  // -------------------------------
  // Refresh buttons
  // -------------------------------
  $$(".admin-refresh-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const target = btn.getAttribute("data-reload");
      if (target === "signals") await loadSignals();
      else if (target === "trades") await loadTrades();
      else if (target === "users") await loadUsers();
      else if (target === "system") await loadSystem();
      else if (target === "engine") await renderEngineStatus();
      else if (target === "broker") await loadUsers();
      else await loadOverview();
    });
  });

  // -------------------------------
  // Trade closing functionality for admin
  // -------------------------------
  window.closeTradeAdmin = async function(tradeId) {
    if (!tradeId) return;
    
    if (!confirm("Are you sure you want to close this trade?")) {
      return;
    }
    
    try {
      const result = await jpostAuth(`/trade/close/${tradeId}`);
      if (result && result.ok) {
        alert("Trade closed successfully!");
        loadTrades(); // Refresh the trades table
        loadOverview(); // Update the overview stats
      } else {
        alert(result?.error || "Failed to close trade");
      }
    } catch (err) {
      console.error("Error closing trade:", err);
      alert("Error closing trade. Please try again.");
    }
  };

  // -------------------------------
  // Real-time updates for P&L in admin
  // -------------------------------
  let adminPnlUpdateInterval = null;
  
  function startAdminPnLUpdates() {
    if (adminPnlUpdateInterval) {
      clearInterval(adminPnlUpdateInterval);
    }
    
    // Update P&L every 5 seconds for open trades
    adminPnlUpdateInterval = setInterval(async () => {
      try {
        const openTrades = document.querySelectorAll('#adminTradesTbody .status-open');
        if (openTrades.length === 0) return; // No open trades to update
        
        const pnlResult = await jgetAuth("/trade/live-pnl");
        if (pnlResult && pnlResult.ok) {
          updateAdminOpenTradesPnL(pnlResult.results || []);
        }
      } catch (err) {
        console.warn("Failed to update admin P&L:", err);
      }
    }, 5000);
  }
  
  function updateAdminOpenTradesPnL(usersPnLData) {
    const tableBody = $("#adminTradesTbody");
    if (!tableBody || !usersPnLData.length) return;
    
    // Create a map for quick lookup
    const pnlMap = {};
    usersPnLData.forEach(userData => {
      const userId = userData.userId;
      (userData.open || []).forEach(trade => {
        if (!pnlMap[userId]) pnlMap[userId] = {};
        pnlMap[userId][trade._id] = trade;
      });
    });
    
    // Update each open trade row with current P&L
    const rows = tableBody.querySelectorAll('tr.status-open');
    rows.forEach(row => {
      const tradeId = row.getAttribute('data-tradeid');
      if (!tradeId) return;
      // Attempt to find trade data in pnlMap across users
      let foundTrade = null;
      for (const [userId, trades] of Object.entries(pnlMap)) {
        if (trades && trades[tradeId]) {
          foundTrade = trades[tradeId];
          break;
        }
      }
      if (!foundTrade) return;

      const cells = row.querySelectorAll('td');
      if (cells.length >= 8) {
        // Update current price
        cells[4].textContent = formatCurrency(foundTrade.ltp || foundTrade.entryPrice);

        // Update P&L
        const pnlAbs = foundTrade.pnlAbs || 0;
        const pnlPct = foundTrade.pnlPct || 0;
        const pnlCell = cells[7];
        pnlCell.textContent = `${formatCurrency(pnlAbs)} (${pnlPct.toFixed(2)}%)`;
        pnlCell.className = pnlAbs >= 0 ? 'pnl-positive' : 'pnl-negative';
      }
    });
  }
  
  function stopAdminPnLUpdates() {
    if (adminPnlUpdateInterval) {
      clearInterval(adminPnlUpdateInterval);
      adminPnlUpdateInterval = null;
    }
  }

  // -------------------------------
  // Initial load + polling
  // -------------------------------
  async function initialLoad() {
    await loadOverview();
    await loadSignals();
    await loadTrades();
    await loadUsers();
    await loadSystem();
    await renderEngineStatus();
    await loadFyersStatus({ quiet: true });
  }

  initialLoad();

  setInterval(() => {
    loadOverview();
    loadSignals();
    loadTrades();
    renderEngineStatus();
    loadFyersStatus({ quiet: true });
  }, 30000);

  // Start real-time P&L updates for admin
  startAdminPnLUpdates();
  
  // Stop updates when leaving the page
  window.addEventListener('beforeunload', stopAdminPnLUpdates);
  
  // Check exits for open trades every 10 seconds (for automatic target/stop closing)
  setInterval(async () => {
    try {
      await jpostAuth("/trade/check-exit");
    } catch (err) {
      console.warn("Failed to check trade exits:", err);
    }
  }, 10000);

  // -------------------------------
  // Live data stream viewer (demo polling)
  // -------------------------------
  (() => {
    const box = document.getElementById("socketStreamBox");
    const clearBtn = document.getElementById("btnClearSocketLog");
    if (!box) return;

    async function fetchLatestTicks() {
      try {
        const res = await fetch("/api/socket-stream");
        const data = await res.json();
        renderTicks(data);
      } catch (err) {
        console.error("socket-stream fetch error:", err);
      }
    }

    function renderTicks(arr) {
      if (!Array.isArray(arr) || arr.length === 0) {
        box.innerHTML = "<div style='opacity:0.6'>No recent ticks</div>";
        return;
      }
      const html = arr
        .slice(-50)
        .reverse()
        .map(
          (t) =>
            `<div><span style="color:#4effa1;">${t.symbol}</span> @ ${t.ltp} <span style="opacity:0.6;">(${new Date(t.ts).toLocaleTimeString()})</span></div>`
        )
        .join("");
      box.innerHTML = html;
    }

    clearBtn?.addEventListener("click", () => {
      box.innerHTML = "<div style='opacity:0.6'>Cleared</div>";
    });

    setInterval(fetchLatestTicks, 2000);
  })();
})(); 
