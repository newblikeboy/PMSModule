(function () {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const body = document.body;

  const PLAN_CONFIG = {
    Monthly: { label: "Monthly", displayAmount: "\u20B91,000" },
    Quarterly: { label: "Quarterly", displayAmount: "\u20B92,100" },
    Yearly: { label: "Yearly", displayAmount: "\u20B96,000" }
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
  const tradingEngineToggleBtn = $("#tradingEngineToggleBtn");
  const angelClientIdInput = $("#angelClientIdInput");
  const saveAngelClientIdBtn = $("#saveAngelClientIdBtn");
  const angelClientIdMsg = $("#angelClientIdMsg");

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
      angelLinkAcknowledged = false;
      const popup = window.open(resp.url, "_blank", "width=520,height=680");
      if (!popup || popup.closed) {
        alert("Please enable pop-ups for this site and try again to complete Angel login.");
      } else {
        popup.focus();
        startAngelLinkWatcher();
      }
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

    // Instant UI refresh + switch to profile/broker view
    try {
      // Show broker section: prefer 'profileView' then scroll to '#brokerSection' if present
      try {
        showView("profileView");
      } catch (e) {
        // ignore if view id missing
      }
      const brokerSection = $("#brokerSection") || $("#angelSection") || document.getElementById("broker");
      if (brokerSection) {
        // small delay to let UI switch
        setTimeout(() => {
          brokerSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      }
    } catch (_) {}

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

      // ===== INSTANT UI UPDATE =====
      // Update UI immediately based on server response
      const angelData = resp.angel || {};
      updateAngelUI(angelData);

      // Update broker text/badges right away
      $("#userBroker") && ($("#userBroker").textContent = "Broker: ANGEL");
      $("#brokerStatus") && ($("#brokerStatus").textContent = "ANGEL");
      $("#sidebarBrokerPill") && ($("#sidebarBrokerPill").textContent = "Broker: ANGEL");

      // Keep connect button enabled (per your choice)
      if (startAngelLoginBtn) {
        startAngelLoginBtn.disabled = false;
        startAngelLoginBtn.textContent = startAngelLoginBtn.getAttribute("data-original") || startAngelLoginBtn.textContent;
      }

      // Stop poller & acknowledge immediately
      stopAngelLinkWatcher();
      angelLinkAcknowledged = true;

      // Refresh profile & plan silently in background
      try {
        await loadProfile();
        await loadPlanStatus();
      } catch (e) {
        console.warn("Background refresh failed:", e);
      }

      // Show alert to user and switch to broker area
      alert("Angel account linked successfully.");
      try {
        showView("profileView");
      } catch (e) {}
      const brokerSection = $("#brokerSection") || $("#angelSection") || document.getElementById("broker");
      if (brokerSection) {
        setTimeout(() => {
          brokerSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      }

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

  tradingEngineToggleBtn?.addEventListener("click", async () => {
    // Check conditions and show alerts if disabled
    const hasAccess = (currentUserProfile?.plan && currentUserProfile.plan !== "Free") || currentUserProfile?.role === "Admin";
    const connected = currentUserProfile?.broker?.connected && currentUserProfile?.broker?.brokerName === "ANGEL";

    if (!hasAccess && connected) {
      alert("Please Buy The Subscription to Enable the Trading Engine..");
      return;
    }

    if (hasAccess && !connected) {
      alert("Please connect your Angel One Broker first");
      return;
    }

    if (!hasAccess && !connected) {
      alert("Please Buy The Subscription and connect your Angel One Broker to Enable the Trading Engine..");
      return;
    }

    // If button is disabled for other reasons, return
    if (tradingEngineToggleBtn.disabled) return;

    const currentState = $("#tradingEngineStatus")?.dataset.state === "on";
    const newState = !currentState;

    // Toggle both liveEnabled and autoTradingEnabled
    const liveResp = await jpostAuth("/user/angel/settings", { liveEnabled: newState });
    if (!liveResp.ok) {
      alert(liveResp.error || "Failed to update live trading");
      return;
    }

    const autoResp = await jpostAuth("/user/broker/automation", { enable: newState });
    if (!autoResp.ok) {
      alert(autoResp.error || "Failed to update automation");
      return;
    }

    // Reload profile to get updated state
    await loadProfile();
    await loadPlanStatus();
  });

  saveAngelClientIdBtn?.addEventListener("click", async () => {
    if (saveAngelClientIdBtn.disabled) return;
    const clientId = angelClientIdInput?.value?.trim();
    if (!clientId) {
      if (angelClientIdMsg) {
        angelClientIdMsg.textContent = "Please enter a valid Client ID.";
        angelClientIdMsg.style.color = "var(--app-danger)";
      }
      return;
    }

    saveAngelClientIdBtn.disabled = true;
    saveAngelClientIdBtn.textContent = "Saving...";

    const resp = await jpostAuth("/user/broker/client-id", { clientId });
    if (!resp.ok) {
      if (angelClientIdMsg) {
        angelClientIdMsg.textContent = resp.error || "Failed to save Client ID.";
        angelClientIdMsg.style.color = "var(--app-danger)";
      }
    } else {
      if (angelClientIdMsg) {
        angelClientIdMsg.textContent = "Client ID saved successfully.";
        angelClientIdMsg.style.color = "var(--app-success)";
      }
      // Reload profile to ensure UI is in sync with database
      await loadProfile();
    }

    saveAngelClientIdBtn.disabled = false;
    saveAngelClientIdBtn.textContent = "Save Client ID";
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

    const role = planRes.role || "User";
    const plan = planRes.plan || "Free";
    const tierLabel = PLAN_CONFIG[plan]?.label || plan;
    const isPaid = plan !== "Free";
    const badgeLabel = isPaid ? tierLabel : "Free";

    $("#userPlan") && ($("#userPlan").textContent = `Plan: ${badgeLabel}`);
    $("#sidebarPlanPill") && ($("#sidebarPlanPill").textContent = `Plan: ${badgeLabel}`);

    const planNameEl = $("#planName");
    const planHintEl = $("#planHint");

    if (planNameEl) {
      if (role === "Admin") {
        planNameEl.textContent = `Admin - ${tierLabel}`;
      } else if (isPaid) {
        planNameEl.textContent = `${plan} Plan`;
      } else {
        planNameEl.textContent = "Free Plan (Upgrade Available)";
      }
    }

    if (planHintEl) {
      planHintEl.textContent = isPaid || role === "Admin"
        ? "You have full access. Angel live execution can be enabled."
        : "Upgrade to unlock automation and live Angel execution.";
    }

    if (subscribeBtn) {
      subscribeBtn.textContent = isPaid || role === "Admin" ? "Plan Active" : "Subscribe Now";
      subscribeBtn.disabled = isPaid || role === "Admin";
    }

    if (upgradePlanBtn) {
      upgradePlanBtn.textContent = isPaid || role === "Admin" ? "Plan Active" : "Upgrade Plan";
      upgradePlanBtn.disabled = isPaid || role === "Admin";
    }
  }

  // ----------------------------------------
  // Profile / Angel state
  // ----------------------------------------
  async function loadAngelFunds() {
    const resp = await jgetAuth("/user/angel/funds");
    const fundsEl = $("#angelTotalFunds");
    if (!resp || !resp.ok) {
      if (fundsEl) fundsEl.textContent = "--";
      return;
    }
    const margin = Number(resp.availableMargin || 0);
    if (fundsEl) {
      fundsEl.textContent = formatCurrency(margin);
    }
  }

  function updateAngelUI(angel, user) {
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
    const autoEnabled = !!user?.autoTradingEnabled;
    const hasAccess = (user?.plan && user.plan !== "Free") || user?.role === "Admin";
    const engineEnabled = hasAccess && liveEnabled && autoEnabled; // Both flags AND access required for engine ON

    const engineStatus = $("#tradingEngineStatus");
    if (engineStatus) {
      engineStatus.textContent = engineEnabled ? "Engine ON" : "Engine OFF";
      engineStatus.dataset.state = engineEnabled ? "on" : "off";
      engineStatus.classList.toggle("good", engineEnabled);
      engineStatus.classList.toggle("danger", !engineEnabled);
    }

    const engineBtn = $("#tradingEngineToggleBtn");
    if (engineBtn) {
      engineBtn.textContent = engineEnabled ? "Disable Trading Engine" : "Enable Trading Engine";
      // Enable if connected OR has access (so users can click and get alerts)
      engineBtn.disabled = !(connected || hasAccess);
    }

    const marginMsg = $("#angelMarginMsg");
    if (marginMsg) {
      marginMsg.textContent = "Live Angel orders will use at most this percentage of your available margin.";
      marginMsg.style.color = "var(--app-text-soft)";
    }

    // Update Angel Client ID input and display
    const clientIdInput = $("#angelClientIdInput");
    const currentClientIdDisplay = $("#currentAngelClientId");
    if (clientIdInput) {
      // Display the current clientId from profile
      const currentClientId = user?.broker?.clientId || "";
      clientIdInput.value = currentClientId;
      if (currentClientIdDisplay) {
        currentClientIdDisplay.textContent = currentClientId || "Not set";
      }
    }

    // Load funds if connected
    if (connected) {
      loadAngelFunds();
    } else {
      const fundsEl = $("#angelTotalFunds");
      if (fundsEl) fundsEl.textContent = "--";
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

    const displayName = (user.name || user.email || "Account").trim();
    const firstName = displayName.split(" ")[0];
    const initial = (displayName.charAt(0) || "U").toUpperCase();
    profileName && (profileName.textContent = firstName);
    profileInitial && (profileInitial.textContent = initial);

    updateAngelUI(user.angel || {}, user);
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
  // Trading Engine toggle (combined logic above)
  // ----------------------------------------

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

  (async () => {
    const payloadRaw = localStorage.getItem("qp_angel_pending_payload");
    if (payloadRaw) {
      try {
        const tokens = JSON.parse(payloadRaw);
        if (tokens && (tokens.authToken || tokens.requestToken)) {
          await completeAngelConnect(tokens);
        }
      } catch (err) {
        console.warn("Unable to parse Angel pending payload:", err);
      } finally {
        localStorage.removeItem("qp_angel_pending_payload");
      }
      return;
    }

    const pending = localStorage.getItem("qp_angel_pending_token");
    if (pending) {
      try {
        const resp = await jgetAuth(`/user/angel/tokens/${pending}`);
        if (resp && resp.ok && resp.tokens) {
          await completeAngelConnect(resp.tokens);
        }
      } finally {
        localStorage.removeItem("qp_angel_pending_token");
      }
    }
  })();
})();
