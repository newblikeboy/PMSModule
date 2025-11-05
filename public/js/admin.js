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
    return res.json();
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
    return res.json();
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

  $$(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      $$(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      $$(".admin-tab-section").forEach((sec) => {
        if (sec.id === tabId) sec.classList.remove("hidden");
        else sec.classList.add("hidden");
      });
    });
  });

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
      body.innerHTML = `<tr><td colspan="5" class="admin-table-placeholder">No data / error</td></tr>`;
      return;
    }

    const actionable = (resp.data || []).filter((row) => row.inEntryZone);
    if (!actionable.length) {
      body.innerHTML = `<tr><td colspan="5" class="admin-table-placeholder">No active entries</td></tr>`;
      return;
    }

    actionable.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.symbol}</td>
        <td>${formatCurrency(row.ltp)}</td>
        <td>${formatCurrency(row.target || row.ltp)}</td>
        <td>${formatCurrency(row.stop || 0)}</td>
        <td>${row.reason || "--"}</td>
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
      body.innerHTML = `<tr><td colspan="7" class="admin-table-placeholder">No data / error</td></tr>`;
      return;
    }

    const trades = resp.trades || [];
    if (!trades.length) {
      body.innerHTML = `<tr><td colspan="7" class="admin-table-placeholder">No trades yet</td></tr>`;
      return;
    }

    trades.forEach((trade) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${trade.symbol}</td>
        <td>${trade.direction}</td>
        <td>${trade.quantity}</td>
        <td>${formatCurrency(trade.entryPrice)}</td>
        <td>${formatCurrency(trade.currentPrice)}</td>
        <td>${trade.status}</td>
        <td>${trade.updatedAt ? new Date(trade.updatedAt).toLocaleTimeString() : "--"}</td>
      `;
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
      const normalizedPlan = String(user.plan || "trial").toLowerCase();
      const planIsPaid = normalizedPlan === "paid" || normalizedPlan === "admin";
      const planClass = planIsPaid ? "plan-paid" : "plan-trial";
      const planLabel =
        normalizedPlan === "admin" ? "Admin" :
        normalizedPlan === "paid" ? "Paid" : "Trial";

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
            <button class="admin-mini-btn pay" data-action="plan-paid" data-id="${user._id}">Paid</button>
            <button class="admin-mini-btn" data-action="plan-trial" data-id="${user._id}">Trial</button>
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

    if (action === "plan-paid" || action === "plan-trial" || action === "plan-admin") {
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
  // Initial load + polling
  // -------------------------------
  async function initialLoad() {
    await loadOverview();
    await loadSignals();
    await loadTrades();
    await loadUsers();
    await loadSystem();
    await renderEngineStatus();
  }

  initialLoad();

  setInterval(() => {
    loadOverview();
    loadSignals();
    loadTrades();
    renderEngineStatus();
  }, 30000);

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

