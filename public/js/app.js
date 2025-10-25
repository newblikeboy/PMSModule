(function(){
  const $ = (sel) => document.querySelector(sel);

  // token auth
  const token = localStorage.getItem("qp_token");
  if (!token) {
    window.location.href = "./index.html";
    return;
  }
  function authHeaders(json=false){
    const h = { "Authorization": "Bearer " + token };
    if (json) h["Content-Type"] = "application/json";
    return h;
  }

  // generic helpers
  async function jgetAuth(url){
    const r = await fetch(url, { headers: authHeaders() });
    if (r.status === 401) {
      localStorage.removeItem("qp_token");
      window.location.href = "./index.html";
      return { ok:false, error:"unauthorized" };
    }
    return r.json();
  }
  async function jpostAuth(url, body){
    const r = await fetch(url, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(body || {})
    });
    if (r.status === 401) {
      localStorage.removeItem("qp_token");
      window.location.href = "./index.html";
      return { ok:false, error:"unauthorized" };
    }
    return r.json();
  }

  // footer year
  const yearNowEl = $('#yearNow');
  if (yearNowEl) {
    yearNowEl.textContent = new Date().getFullYear();
  }

  // logout
  $('#logoutBtn')?.addEventListener('click', ()=>{
    localStorage.removeItem("qp_token");
    window.location.href = "./index.html";
  });

  //-------------------------------------------------
  // 1. SUBSCRIPTION / PLAN STATUS
  //-------------------------------------------------
  async function loadPlanStatus(){
    const planRes = await jgetAuth('/user/plan/status');
    if (!planRes || !planRes.ok) return;

    const plan = planRes.plan; // "trial", "paid", "admin"

    // Update header bar badge
    $('#userPlan') && ($('#userPlan').textContent = "Plan: " + plan);

    // Update subscription card
    const planNameEl = $('#planName');
    const planHintEl = $('#planHint');
    const upgradeBtn = $('#upgradePlanBtn');

    if (plan === "paid" || plan === "admin") {
      planNameEl && (planNameEl.textContent = "Paid Plan");
      planHintEl && (planHintEl.textContent = "You have Paid access. Automation unlocks.");
      if (upgradeBtn){
        upgradeBtn.textContent = "You're Upgraded ✓";
        upgradeBtn.disabled = true;
      }
    } else {
      planNameEl && (planNameEl.textContent = "Trial (Upgrade Available)");
      planHintEl && (planHintEl.textContent = "Upgrade to unlock automation & broker execution (coming soon).");
      if (upgradeBtn){
        upgradeBtn.textContent = "Upgrade Plan";
        upgradeBtn.disabled = false;
      }
    }
  }

  // handle Upgrade Plan click
  $('#upgradePlanBtn')?.addEventListener('click', async ()=>{
    // Step 1: ask backend to create a payment intent
    const intent = await jpostAuth('/user/plan/upgrade-intent', {});
    console.log("upgrade-intent:", intent);

    if (!intent.ok) {
      alert(intent.error || "Could not start upgrade");
      return;
    }

    if (intent.alreadyPaid) {
      alert("Already on Paid plan");
      await loadPlanStatus();
      return;
    }

    // Normally: redirect to Razorpay/Stripe checkout using intent.paymentRef.
    // MVP: we instantly confirm as if payment happened.

    const confirm = await jpostAuth('/user/plan/confirm', {
      paymentRef: intent.paymentRef
    });
    console.log("upgrade-confirm:", confirm);

    if (!confirm.ok) {
      alert(confirm.error || "Payment confirmation failed");
      return;
    }

    // Refresh UI
    await loadPlanStatus();
    await loadProfile();

    alert("You're now on Paid Plan ✅");
  });


  //-------------------------------------------------
  // 2. PROFILE (plan, broker, automation)
  //-------------------------------------------------
  async function loadProfile(){
    const p = await jgetAuth('/user/profile');
    if (!p || !p.ok) return;

    // broker status text
    const brokerStr = p.user.broker?.connected
      ? (p.user.broker.brokerName || "Broker Connected")
      : "Not Connected";

    $('#userBroker')  && ($('#userBroker').textContent = "Broker: " + brokerStr);
    $('#brokerStatus')&& ($('#brokerStatus').textContent = brokerStr);

    // automation toggle reflect actual state
    $('#autoMode')    && ($('#autoMode').textContent = p.user.autoTradingEnabled ? "ON" : "OFF");
    const toggleBtn = $('#toggleAutoBtn');
    if (toggleBtn) {
      toggleBtn.textContent = p.user.autoTradingEnabled
        ? "Disable Auto Trading"
        : "Enable Auto Trading";
    }
  }


  //-------------------------------------------------
  // 3. SIGNALS TABLE (Today's Opportunities)
  //-------------------------------------------------
  async function loadSignals(){
    const resp = await jgetAuth('/user/signals'); // {ok, data:[...]}
    const body = $('#signalsTableBody');
    body.innerHTML = "";

    if (!resp || !resp.ok){
      body.innerHTML = `<tr><td colspan="5">No data / error</td></tr>`;
      return;
    }

    const actionable = (resp.data || []).filter(r => r.inEntryZone);
    if (!actionable.length){
      body.innerHTML = `<tr><td colspan="5">No active entries right now</td></tr>`;
      return;
    }

    actionable.forEach(sig => {
      const entry = Number(sig.ltp || 0);
      const target = entry ? (entry * (1 + 1.5/100)) : 0;
      const stop   = entry ? (entry * (1 - 0.75/100)) : 0;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${sig.symbol}</td>
        <td>₹${entry ? entry.toFixed(2) : "--"}</td>
        <td>₹${target ? target.toFixed(2) : "--"}</td>
        <td>₹${stop ? stop.toFixed(2) : "--"}</td>
        <td><button class="app-act-btn" disabled>Auto Trade (Soon)</button></td>
      `;
      body.appendChild(tr);
    });
  }


  //-------------------------------------------------
  // 4. DAILY REPORT STATS
  //-------------------------------------------------
  async function loadDailyReport(){
    const rep = await jgetAuth('/user/report-today'); // {ok, summary,...}
    const elClosed = $('#repClosed');
    const elWL = $('#repWL');
    const elPnL = $('#repPnL');
    const elBest = $('#repBest');

    if (!rep || !rep.ok){
      elClosed && (elClosed.textContent = "--");
      elWL && (elWL.textContent = "--");
      elPnL && (elPnL.textContent = "--");
      elBest && (elBest.textContent = "--");
      return;
    }

    const s = rep.summary;
    elClosed && (elClosed.textContent = s.closedTrades ?? 0);
    elWL && (elWL.textContent = (s.wins ?? 0) + " / " + (s.losses ?? 0));

    if (elPnL){
      const pnl = (s.grossPnLAbs ?? 0).toFixed(2);
      elPnL.textContent = "₹" + pnl;
      elPnL.style.color = (s.grossPnLAbs ?? 0) >= 0 ? "var(--good)" : "#d11f4a";
    }

    if (elBest){
      if (s.bestTrade){
        elBest.textContent = `${s.bestTrade.symbol} (₹${(s.bestTrade.pnlAbs ?? 0).toFixed(2)})`;
      } else {
        elBest.textContent = "--";
      }
    }
  }


  //-------------------------------------------------
  // 5. OPEN TRADES TABLE
  //-------------------------------------------------
  async function loadTrades(){
    const resp = await jgetAuth('/user/trades'); // {ok, trades:[...]}
    const body = $('#tradesTableBody');
    body.innerHTML = "";

    if (!resp || !resp.ok){
      body.innerHTML = `<tr><td colspan="6">No data / error</td></tr>`;
      return;
    }

    const openTrades = (resp.trades || []).filter(t => t.status === "OPEN");
    if (!openTrades.length){
      body.innerHTML = `<tr><td colspan="6">No open trades</td></tr>`;
      return;
    }

    openTrades.forEach(trade=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${trade.symbol}</td>
        <td>${trade.qty}</td>
        <td>₹${Number(trade.entryPrice).toFixed(2)}</td>
        <td>₹${Number(trade.targetPrice).toFixed(2)}</td>
        <td>₹${Number(trade.stopPrice).toFixed(2)}</td>
        <td>${trade.status}</td>
      `;
      body.appendChild(tr);
    });
  }


  //-------------------------------------------------
  // 6. BROKER MODAL (connect/update broker creds)
  //-------------------------------------------------
  const brokerModal = $('#brokerModal');
  const openBrokerModalBtn = $('#openBrokerModalBtn');
  const closeBrokerModalBtn = $('#closeBrokerModalBtn');
  const brokerForm = $('#brokerForm');
  const brokerMsg = $('#brokerMsg');
  const brokerSubmitBtn = $('#brokerSubmitBtn');

  function openBrokerModal(){
    if (brokerModal) brokerModal.style.display = "flex";
  }
  function closeBrokerModal(){
    if (brokerModal) brokerModal.style.display = "none";
  }

  openBrokerModalBtn?.addEventListener("click", openBrokerModal);
  closeBrokerModalBtn?.addEventListener("click", closeBrokerModal);

  brokerModal?.addEventListener("click", (e)=>{
    if (e.target === brokerModal) {
      closeBrokerModal();
    }
  });

  brokerForm?.addEventListener("submit", async (e)=>{
    e.preventDefault();

    if (brokerSubmitBtn){
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

    const resp = await jpostAuth('/user/broker/connect', payload);
    console.log("broker connect resp", resp);

    if (!resp.ok){
      if (brokerMsg){
        brokerMsg.textContent = resp.error || "Failed to save";
        brokerMsg.style.color = "#d11f4a";
      }
      brokerSubmitBtn.disabled = false;
      brokerSubmitBtn.textContent = "Save Broker →";
      return;
    }

    if (brokerMsg){
      brokerMsg.textContent = "Broker connected (paper mode).";
      brokerMsg.style.color = "var(--good)";
    }
    brokerSubmitBtn.textContent = "Saved ✓";

    await loadProfile();
    await loadPlanStatus();

    setTimeout(()=>{
      closeBrokerModal();
      brokerSubmitBtn.disabled = false;
      brokerSubmitBtn.textContent = "Save Broker →";
    }, 800);
  });


  //-------------------------------------------------
  // 7. TOGGLE AUTOMATION (ON/OFF)
  //-------------------------------------------------
  $('#toggleAutoBtn')?.addEventListener("click", async ()=>{
    const curr = ($('#autoMode')?.textContent || "OFF").trim().toUpperCase();
    const wantEnable = curr !== "ON";

    const resp = await jpostAuth('/user/broker/automation', { enable: wantEnable });
    if (!resp.ok){
      alert(resp.error || "Failed to update automation");
      return;
    }

    await loadProfile();
    await loadPlanStatus();
  });


  //-------------------------------------------------
  // REFRESH BUTTONS
  //-------------------------------------------------
  $('#btnRefreshSignals')?.addEventListener('click', loadSignals);
  $('#btnRefreshReport')?.addEventListener('click', loadDailyReport);
  $('#btnRefreshTrades')?.addEventListener('click', loadTrades);


  //-------------------------------------------------
  // INITIAL LOAD SEQUENCE
  //-------------------------------------------------
  loadPlanStatus();
  loadProfile();
  loadSignals();
  loadDailyReport();
  loadTrades();

  // re-poll every 30s
  setInterval(()=>{
    loadPlanStatus();
    loadProfile();
    loadSignals();
    loadDailyReport();
    loadTrades();
  }, 30000);

})();
