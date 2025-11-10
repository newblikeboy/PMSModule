(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const body = document.body;

  const PLAN_CONFIG = {
    monthly: { label: "Monthly", displayAmount: "\u20B91,000" },
    quarterly: { label: "Quarterly", displayAmount: "\u20B92,100" },
    yearly: { label: "Yearly", displayAmount: "\u20B96,000" }
  };

  let currentUserProfile = null;
  let angelLinkInProgress = false;
  let angelLinkPollTimer = null;
  let angelLinkDeadline = 0;
  let angelLinkAcknowledged = false;

  // ----------------------------------------
  // Auth guard
  // ----------------------------------------
  const token = localStorage.getItem("qp_token");
  if (!token) {
    window.location.href = "./index.html";
    return;
  }

  // ----------------------------------------
  // Sidebar & view switching
  // ----------------------------------------
  const sidebar = $("#appSidebar");
  const menuBtn = $("#appMenuBtn");
  const sidebarClose = $("#appSidebarClose");
  const sidebarOverlay = $("#appSidebarOverlay");
  const navButtons = $$(".app-nav-item");
  const views = $$(".app-view");

  const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches;

  const openSidebar = () => {
    if (!sidebar) return;
    body.classList.add("sidebar-open");
  };

  const closeSidebar = () => {
    body.classList.remove("sidebar-open");
  };

  menuBtn?.addEventListener("click", openSidebar);
  sidebarClose?.addEventListener("click", closeSidebar);
  sidebarOverlay?.addEventListener("click", closeSidebar);
  window.addEventListener("resize", () => {
    if (isDesktop()) closeSidebar();
  });

  const setActiveNav = (viewId) => {
    navButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.view === viewId);
    });
  };

  const showView = (viewId) => {
    views.forEach((view) => {
      const isActive = view.id === viewId;
      view.classList.toggle("active", isActive);
    });
    setActiveNav(viewId);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!isDesktop()) closeSidebar();
  };

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewId = btn.dataset.view;
      if (viewId) showView(viewId);
    });
  });

  showView("overviewView");

  // ----------------------------------------
  // Profile dropdown & header actions
  // ----------------------------------------
  const profileToggle = $("#profileToggle");
  const profileDropdown = $("#profileDropdown");
  const profileInitial = $("#profileInitial");
  const profileName = $("#profileName");

  const closeProfileDropdown = () => profileDropdown?.classList.remove("open");

  profileToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    profileDropdown?.classList.toggle("open");
  });

  document.addEventListener("click", (event) => {
    if (!profileDropdown || !profileToggle) return;
    if (!profileDropdown.contains(event.target) && !profileToggle.contains(event.target)) {
      closeProfileDropdown();
    }
  });

  const subscribeBtn = $("#subscribeBtn");
  const upgradePlanBtn = $("#upgradePlanBtn");
  const pricingModal = $("#pricingModal");
  const pricingModalClose = $("#pricingModalClose");
  const pricingModalMsg = $("#pricingModalMsg");
  const pricingButtons = $$(".pricing-select");
  const startAngelLoginBtn = $("#startAngelLoginBtn");
  const angelMarginForm = $("#angelMarginForm");
  const angelMarginSaveBtn = $("#angelMarginSaveBtn");
  const angelLiveToggleBtn = $("#angelLiveToggleBtn");

  const openPricingModal = (trigger) => {
    if (trigger?.disabled) return;
    pricingModal?.classList.add("open");
    if (pricingModalMsg) pricingModalMsg.textContent = "";
  };

  const closePricingModal = () => {
    pricingModal?.classList.remove("open");
  };

  subscribeBtn?.addEventListener("click", () => openPricingModal(subscribeBtn));
  upgradePlanBtn?.addEventListener("click", () => openPricingModal(upgradePlanBtn));
  pricingModalClose?.addEventListener("click", closePricingModal);
  pricingModal?.addEventListener("click", (event) => {
    if (event.target === pricingModal) closePricingModal();
  });

  pricingButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const plan = btn.dataset.plan;
      if (!plan) return;

      const cfg = PLAN_CONFIG[plan];
      if (pricingModalMsg && cfg) {
        pricingModalMsg.style.color = "var(--app-text-soft)";
        pricingModalMsg.textContent = `Processing ${cfg.label} plan (${cfg.displayAmount}).`;
      }

      launchCheckout(plan);
    });
  });

  $("#profileOption")?.addEventListener("click", () => {
    closeProfileDropdown();
    window.location.href = "/profile";
  });

  $("#passwordOption")?.addEventListener("click", () => {
    closeProfileDropdown();
    window.location.href = "/change-password";
  });

  const logout = () => {
    localStorage.removeItem("qp_token");
    window.location.href = "./index.html";
  };

  $("#logoutOption")?.addEventListener("click", () => {
    closeProfileDropdown();
    logout();
  });

  startAngelLoginBtn?.addEventListener("click", async () => {
    if (startAngelLoginBtn.disabled) return;
    const originalText = startAngelLoginBtn.textContent;
    startAngelLoginBtn.disabled = true;
    startAngelLoginBtn.textContent = "Opening...";

    const resp = await jgetAuth("/user/angel/login-link");
    if (!resp || !resp.ok) {
      alert(resp?.error || "Unable to generate Angel login link");
    } else {
      window.open(resp.url, "_blank", "width=520,height=680");
      angelLinkAcknowledged = false;
      startAngelLinkWatcher();
    }

    startAngelLoginBtn.textContent = originalText;
    startAngelLoginBtn.disabled = false;
  });

  function notifyAngelLinked(message) {
    alert(message || "Angel account linked successfully.");
  }

  function acknowledgeAngelLink(message) {
    if (angelLinkAcknowledged) return;
    angelLinkAcknowledged = true;
    stopAngelLinkWatcher();
    notifyAngelLinked(message || "Angel account linked successfully.");
  }

  function stopAngelLinkWatcher() {
    if (angelLinkPollTimer) {
      clearTimeout(angelLinkPollTimer);
      angelLinkPollTimer = null;
    }
    angelLinkInProgress = false;
    angelLinkDeadline = 0;
  }

  async function pollAngelLinkStatus() {
    if (!angelLinkInProgress) return;
    if (angelLinkDeadline && Date.now() > angelLinkDeadline) {
      stopAngelLinkWatcher();
      return;
    }
    try {
      const profile = await loadProfile();
      const broker = profile?.broker || {};
      if (broker.connected && (broker.brokerName || "").toUpperCase() === "ANGEL") {
        acknowledgeAngelLink();
        return;
      }
    } catch (err) {
      console.warn("Angel link poll failed:", err);
    }
    angelLinkPollTimer = setTimeout(pollAngelLinkStatus, 4000);
  }

  function startAngelLinkWatcher() {
    stopAngelLinkWatcher();
    angelLinkInProgress = true;
    angelLinkDeadline = Date.now() + 2 * 60 * 1000;
    pollAngelLinkStatus();
  }

  async function completeAngelConnect(tokens) {
    try {
      const resp = await jpostAuth("/user/angel/complete", {
        authToken: tokens.authToken || tokens.auth_token || null,
        requestToken: tokens.requestToken || tokens.request_token || null,
        feedToken: tokens.feedToken || tokens.feed_token || null,
        refreshToken: tokens.refreshToken || tokens.refresh_token || null,
        tokenId: tokens.tokenId || null // Include tokenId for fallback
      });

      if (!resp || !resp.ok) {
        alert(resp?.error || "Angel link failed. Please retry.");
        return;
      }

      updateAngelUI(resp.angel || {});
      await loadProfile();
      acknowledgeAngelLink("Angel account linked successfully.");
    } catch (err) {
      console.error("Angel completion error:", err);
      alert("Unexpected error completing Angel link. Please retry.");
    }
  }

  window.addEventListener("message", async (event) => {
    const data = event?.data;
    if (!data || data.provider !== "angel") return;
    if (!data.ok) {
      alert(data?.message || "Angel login was cancelled or failed.");
      return;
    }

    const tokens = data.tokens || {};

    // If postMessage succeeded, use the tokens directly
    if (tokens.authToken || tokens.requestToken) {
      await completeAngelConnect(tokens);
      return;
    }

    if (tokens.completed) {
      await loadProfile();
      acknowledgeAngelLink(data.message || "Angel account linked successfully.");
      return;
    }

    if (tokens.tokenId) {
      // If postMessage failed, fetch tokens from server using tokenId
      try {
        const resp = await jgetAuth(`/user/angel/tokens/${tokens.tokenId}`);
        if (resp && resp.ok && resp.tokens) {
          await completeAngelConnect(resp.tokens);
        } else {
          alert("Failed to retrieve tokens from server. Please retry.");
        }
      } catch (err) {
        console.error("Error fetching stored tokens:", err);
        alert("Failed to retrieve tokens from server. Please retry.");
      }
      return;
    }

    if (data.ok) {
      await loadProfile();
      notifyAngelLinked(data.message || "Angel account linked successfully.");
      return;
    }

    alert("Angel login did not return valid tokens. Please retry.");
  });

  angelMarginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const slider = $("#angelMarginInput");
    if (!slider) return;

    const pct = Number(slider.value);
    if (Number.isNaN(pct) || pct < 0 || pct > 100) {
      alert("Enter a value between 0 and 100.");
      return;
    }

    if (angelMarginSaveBtn) {
      angelMarginSaveBtn.disabled = true;
      angelMarginSaveBtn.textContent = "Saving...";
    }

    const msgEl = $("#angelMarginMsg");
    const resp = await jpostAuth("/user/angel/settings", { allowedMarginPercent: pct });

    if (!resp.ok) {
      if (msgEl) {
        msgEl.textContent = resp.error || "Failed to update margin";
        msgEl.style.color = "var(--app-danger)";
      }
    } else {
      updateAngelUI(resp.angel || {});
      if (msgEl) {
        msgEl.textContent = "Margin preference saved.";
        msgEl.style.color = "var(--app-success)";
      }
    }

    if (angelMarginSaveBtn) {
      angelMarginSaveBtn.disabled = false;
      angelMarginSaveBtn.textContent = "Save Risk Budget";
    }
  });

  angelLiveToggleBtn?.addEventListener("click", async () => {
    if (angelLiveToggleBtn.disabled) return;
    const currentState = $("#angelLiveStatus")?.dataset.state === "on";
    const resp = await jpostAuth("/user/angel/settings", { liveEnabled: !currentState });
    if (!resp.ok) {
      alert(resp.error || "Failed to update live status");
      return;
    }
    updateAngelUI(resp.angel || {});
    await loadPlanStatus();
  });

  // ----------------------------------------
  // Helper utilities
  // ----------------------------------------
  const authHeaders = (json = false) => {
    const headers = { Authorization: "Bearer " + token };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  };

  const jgetAuth = async (url) => {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401) {
      logout();
      return { ok: false };
    }
    return res.json();
  };

  const jpostAuth = async (url, body) => {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(body || {})
    });
    if (res.status === 401) {
      logout();
      return { ok: false };
    }
    return res.json();
  };

  const formatCurrency = (val) => {
    const amount = Number(val ?? 0);
    if (Number.isNaN(amount)) return "\u20B90.00";
    return `\u20B9${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Footer year
  const yearNowEl = $("#yearNow");
  if (yearNowEl) yearNowEl.textContent = new Date().getFullYear();

  // ----------------------------------------
  // Razorpay checkout
  // ----------------------------------------
  async function launchCheckout(planType) {
    if (!PLAN_CONFIG[planType]) {
      pricingModalMsg && (pricingModalMsg.textContent = "Unknown plan selected.");
      return;
    }

    if (pricingModalMsg) {
      pricingModalMsg.style.color = "var(--app-text-soft)";
      pricingModalMsg.textContent = "Creating payment intent...";
    }

    try {
      const intent = await jpostAuth("/user/plan/upgrade-intent", { planType });
      if (!intent || !intent.ok) {
        throw new Error(intent?.error || "Unable to start checkout");
      }

      if (typeof Razorpay === "undefined") {
        throw new Error("Razorpay script not loaded. Check your network or ad-block settings.");
      }

      const amountDisplay = (intent.amount / 100).toFixed(2);
      if (pricingModalMsg) {
        pricingModalMsg.textContent = `Launching Razorpay for ?${amountDisplay}...`;
      }

      const options = {
        key: intent.keyId,
        amount: intent.amount,
        currency: intent.currency,
        name: "QuantPulse",
        description: `${PLAN_CONFIG[planType].label} Plan`,
        order_id: intent.orderId,
        theme: { color: "#3f5fff" },
        prefill: {
          name: currentUserProfile?.name || "",
          email: currentUserProfile?.email || "",
          contact: currentUserProfile?.phone || ""
        },
        handler: async (response) => {
          if (pricingModalMsg) {
            pricingModalMsg.style.color = "var(--app-text-soft)";
            pricingModalMsg.textContent = "Verifying payment...";
          }

          const confirm = await jpostAuth("/user/plan/confirm", {
            ...response,
            planType
          });

          if (!confirm || !confirm.ok) {
            const msg = confirm?.error || "Payment verification failed";
            if (pricingModalMsg) {
              pricingModalMsg.style.color = "var(--app-danger)";
              pricingModalMsg.textContent = msg;
            }
            return;
          }

          if (pricingModalMsg) {
            pricingModalMsg.style.color = "var(--app-success)";
            pricingModalMsg.textContent = "Payment successful. Activating your plan...";
          }

          await loadPlanStatus();
          await loadProfile();
          closePricingModal();
        }
      };

      const rzp = new Razorpay(options);
      rzp.on("payment.failed", (err) => {
        if (pricingModalMsg) {
          pricingModalMsg.style.color = "var(--app-danger)";
          pricingModalMsg.textContent = err?.error?.description || "Payment failed. Please try again.";
        }
      });
      rzp.open();
    } catch (error) {
      console.error("Razorpay checkout error:", error);
      if (pricingModalMsg) {
        pricingModalMsg.style.color = "var(--app-danger)";
        pricingModalMsg.textContent = error.message || "Unable to start checkout";
      }
    }
  }

  // ----------------------------------------
  // Plan status
  // ----------------------------------------
  async function loadPlanStatus() {
    const planRes = await jgetAuth("/user/plan/status");
    if (!planRes || !planRes.ok) return;

    const plan = (planRes.plan || "trial").toLowerCase();
    const planTier = (planRes.planTier || plan).toLowerCase();
    const tierLabel =
      PLAN_CONFIG[planTier]?.label || planTier.charAt(0).toUpperCase() + planTier.slice(1);
    const isPaid = plan === "paid" || plan === "admin";
    const badgeLabel = isPaid ? tierLabel : "Trial";

    $("#userPlan") && ($("#userPlan").textContent = `Plan: ${badgeLabel}`);
    $("#sidebarPlanPill") && ($("#sidebarPlanPill").textContent = `Plan: ${badgeLabel}`);

    const planNameEl = $("#planName");
    const planHintEl = $("#planHint");

    if (planNameEl) {
      if (plan === "admin") {
        planNameEl.textContent = `Admin - ${tierLabel}`;
      } else if (isPaid) {
        planNameEl.textContent = `Paid - ${tierLabel}`;
      } else {
        planNameEl.textContent = "Trial (Upgrade Available)";
      }
    }

    if (planHintEl) {
      planHintEl.textContent = isPaid
        ? "You have full access. Angel live execution can be enabled."
        : "Upgrade to unlock automation and live Angel execution.";
    }

    if (subscribeBtn) {
      subscribeBtn.textContent = isPaid ? "Plan Active" : "Subscribe Now";
      subscribeBtn.disabled = isPaid;
    }

    if (upgradePlanBtn) {
      upgradePlanBtn.textContent = isPaid ? "Plan Active" : "Upgrade Plan";
      upgradePlanBtn.disabled = isPaid;
    }
  }

  // ----------------------------------------
  // Profile / Angel state
  // ----------------------------------------
  function updateAngelUI(angel) {
    const connected = !!angel.brokerConnected;
    const connBadge = $("#angelConnBadge");
    if (connBadge) {
      connBadge.textContent = connected ? "Angel Linked" : "Angel Not Linked";
      connBadge.classList.toggle("good", connected);
      connBadge.classList.toggle("danger", !connected);
    }

    let marginPct = Math.round((angel.allowedMarginPct ?? 0.5) * 100);
    const percentFromServer = Number(angel.allowedMarginPercent);
    if (!Number.isNaN(percentFromServer)) {
      marginPct = percentFromServer;
    }

    $("#angelMarginValue") && ($("#angelMarginValue").textContent = `${marginPct}%`);
    const marginInput = $("#angelMarginInput");
    if (marginInput && Number.isFinite(marginPct)) marginInput.value = String(marginPct);

    const liveEnabled = !!angel.liveEnabled;
    const liveStatus = $("#angelLiveStatus");
    if (liveStatus) {
      liveStatus.textContent = liveEnabled ? "Live ON" : "Live OFF";
      liveStatus.dataset.state = liveEnabled ? "on" : "off";
      liveStatus.classList.toggle("good", liveEnabled);
      liveStatus.classList.toggle("danger", !liveEnabled);
    }

    const liveBtn = $("#angelLiveToggleBtn");
    if (liveBtn) {
      liveBtn.textContent = liveEnabled ? "Disable Live" : "Enable Live";
      liveBtn.disabled = !connected;
    }

    const marginMsg = $("#angelMarginMsg");
    if (marginMsg) {
      marginMsg.textContent = "Live Angel orders will use at most this percentage of your available margin.";
      marginMsg.style.color = "var(--app-text-soft)";
    }
  }

  async function loadProfile() {
    const profile = await jgetAuth("/user/profile");
    if (!profile || !profile.ok) return currentUserProfile;

    const user = profile.user || {};
    currentUserProfile = user;

    const brokerConnected = !!user.broker?.connected;
    const brokerName = user.broker?.brokerName || "Not Connected";

    $("#userBroker") && ($("#userBroker").textContent = "Broker: " + brokerName);
    $("#brokerStatus") && ($("#brokerStatus").textContent = brokerConnected ? brokerName : "Not Connected");
    $("#sidebarBrokerPill") && ($("#sidebarBrokerPill").textContent = "Broker: " + brokerName);

    const autoEnabled = !!user.autoTradingEnabled;
    $("#autoMode") && ($("#autoMode").textContent = autoEnabled ? "ON" : "OFF");
    const autoBtn = $("#toggleAutoBtn");
    if (autoBtn) autoBtn.textContent = autoEnabled ? "Disable Auto Trading" : "Enable Auto Trading";

    const displayName = (user.name || user.email || "Account").trim();
    const firstName = displayName.split(" ")[0];
    const initial = (displayName.charAt(0) || "U").toUpperCase();
    profileName && (profileName.textContent = firstName);
    profileInitial && (profileInitial.textContent = initial);

    updateAngelUI(user.angel || {});
    return user;
  }

  // ----------------------------------------
  // Signals / report / trades
  // ----------------------------------------
  async function loadSignals() {
    const resp = await jgetAuth("/user/signals");
    const tableBody = $("#signalsTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    if (!resp || !resp.ok) {
      tableBody.innerHTML = `<tr><td colspan="5">No data / error</td></tr>`;
      return;
    }

    const actionable = (resp.data || []).filter((row) => row.inEntryZone);
    if (!actionable.length) {
      tableBody.innerHTML = `<tr><td colspan="5">No active entries right now</td></tr>`;
      return;
    }

    actionable.forEach((row) => {
      const entry = Number(row.ltp || 0);
      const target = entry * 1.015;
      const stop = entry * 0.9925;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.symbol}</td>
        <td>${formatCurrency(entry)}</td>
        <td>${formatCurrency(target)}</td>
        <td>${formatCurrency(stop)}</td>
        <td><button class="app-act-btn" disabled>Auto Trade (Soon)</button></td>
      `;
      tableBody.appendChild(tr);
    });
  }

  async function loadDailyReport() {
    const rep = await jgetAuth("/user/report-today");
    const closedEl = $("#repClosed");
    const wlEl = $("#repWL");
    const pnlEl = $("#repPnL");
    const bestEl = $("#repBest");

    if (!rep || !rep.ok) {
      closedEl && (closedEl.textContent = "--");
      wlEl && (wlEl.textContent = "--");
      pnlEl && (pnlEl.textContent = "--");
      bestEl && (bestEl.textContent = "--");
      return;
    }

    const s = rep.summary || {};
    closedEl && (closedEl.textContent = s.closedTrades ?? 0);
    wlEl && (wlEl.textContent = `${s.wins ?? 0} / ${s.losses ?? 0}`);

    if (pnlEl) {
      const pnl = Number(s.grossPnLAbs ?? 0);
      pnlEl.textContent = formatCurrency(pnl);
      pnlEl.style.color = pnl >= 0 ? "var(--app-success)" : "var(--app-danger)";
    }

    if (bestEl) {
      if (s.bestTrade) {
        bestEl.textContent = `${s.bestTrade.symbol} (${formatCurrency(s.bestTrade.pnlAbs ?? 0)})`;
      } else {
        bestEl.textContent = "--";
      }
    }
  }

  async function loadTrades() {
    const result = await jgetAuth("/user/trades");
    const tableBody = $("#tradesTableBody");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    if (!result || !result.ok) {
      tableBody.innerHTML = `<tr><td colspan="6">No data / error</td></tr>`;
      return;
    }

    const trades = result.trades || [];
    if (!trades.length) {
      tableBody.innerHTML = `<tr><td colspan="6">No trades yet</td></tr>`;
      return;
    }

    trades.forEach((trade) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${trade.symbol}</td>
        <td>${trade.quantity ?? "--"}</td>
        <td>${formatCurrency(trade.entryPrice)}</td>
        <td>${formatCurrency(trade.targetPrice)}</td>
        <td>${formatCurrency(trade.stopPrice)}</td>
        <td>${trade.status}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  // ----------------------------------------
  // Broker modal (manual credentials)
  // ----------------------------------------
  const brokerModal = $("#brokerModal");
  const openBrokerModalBtn = $("#openBrokerModalBtn");
  const closeBrokerModalBtn = $("#closeBrokerModalBtn");
  const brokerForm = $("#brokerForm");
  const brokerMsg = $("#brokerMsg");
  const brokerSubmitBtn = $("#brokerSubmitBtn");

  const openBrokerModal = () => brokerModal && (brokerModal.style.display = "flex");
  const closeBrokerModal = () => brokerModal && (brokerModal.style.display = "none");

  openBrokerModalBtn?.addEventListener("click", openBrokerModal);
  closeBrokerModalBtn?.addEventListener("click", closeBrokerModal);
  brokerModal?.addEventListener("click", (event) => {
    if (event.target === brokerModal) closeBrokerModal();
  });

  brokerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (brokerSubmitBtn) {
      brokerSubmitBtn.disabled = true;
      brokerSubmitBtn.textContent = "Saving...";
    }

    const fd = new FormData(brokerForm);
    const payload = {
      brokerName: fd.get("brokerName"),
      apiKey: fd.get("apiKey"),
      clientId: fd.get("clientId"),
      accessToken: fd.get("accessToken"),
      refreshToken: fd.get("refreshToken")
    };

    const resp = await jpostAuth("/user/broker/connect", payload);
    if (!resp.ok) {
      if (brokerMsg) {
        brokerMsg.textContent = resp.error || "Failed to save credentials.";
        brokerMsg.style.color = "#d11f4a";
      }
      if (brokerSubmitBtn) {
        brokerSubmitBtn.textContent = "Save Broker";
        brokerSubmitBtn.disabled = false;
      }
      return;
    }

    if (brokerMsg) {
      brokerMsg.textContent = "Broker connected (paper mode).";
      brokerMsg.style.color = "var(--app-success)";
    }

    if (brokerSubmitBtn) {
      brokerSubmitBtn.textContent = "Saved";
      setTimeout(() => {
        brokerSubmitBtn.textContent = "Save Broker";
        brokerSubmitBtn.disabled = false;
        closeBrokerModal();
      }, 800);
    }

    await loadProfile();
    await loadPlanStatus();
  });

  // ----------------------------------------
  // Automation toggle
  // ----------------------------------------
  $("#toggleAutoBtn")?.addEventListener("click", async () => {
    const current = ($("#autoMode")?.textContent || "OFF").trim().toUpperCase();
    const resp = await jpostAuth("/user/broker/automation", { enable: current !== "ON" });
    if (!resp.ok) {
      alert(resp.error || "Failed to update automation");
      return;
    }
    await loadProfile();
    await loadPlanStatus();
  });

  // ----------------------------------------
  // Refresh buttons
  // ----------------------------------------
  $("#btnRefreshSignals")?.addEventListener("click", loadSignals);
  $("#btnRefreshReport")?.addEventListener("click", loadDailyReport);
  $("#btnRefreshTrades")?.addEventListener("click", loadTrades);

  // ----------------------------------------
  // Initial load & polling
  // ----------------------------------------
  loadPlanStatus();
  loadProfile();
  loadSignals();
  loadDailyReport();
  loadTrades();

  setInterval(() => {
    loadPlanStatus();
    loadProfile();
    loadSignals();
    loadDailyReport();
    loadTrades();
  }, 30000);
})();
