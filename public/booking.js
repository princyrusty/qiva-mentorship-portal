/* /booking/:id?t=token — status page, pay later by UPI, Cashfree checkout and return. */
(function () {
  "use strict";
  const Q = window.QIVA;
  const { $, esc, inr, api } = Q;
  const id = decodeURIComponent(location.pathname.split("/").pop() || "");
  const params = new URLSearchParams(location.search);
  const token = params.get("t") || "";
  let cfg, b;
  const tick = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';

  function upiLink(amount) {
    const q = new URLSearchParams({ pa: cfg.upiId, pn: cfg.upiPayee || "QIVA Mentorship", am: Number(amount).toFixed(2), cu: "INR", tn: b.id });
    return "upi://pay?" + q.toString().replace(/\+/g, "%20");
  }

  function render() {
    const paid = ["submitted", "verified", "paid"].includes(b.paymentStatus);
    const verified = ["verified", "paid"].includes(b.paymentStatus);
    const confirmed = b.status === "confirmed" || b.status === "completed";
    const steps = [
      { done: true, t: "Booking created", s: Q.dateIN(b.createdAt) },
      { done: paid, now: !paid, t: paid ? (b.paymentStatus === "paid" ? "Paid online" : verified ? "Payment verified" : "Payment received, being verified") : "Payment needed", s: b.utrLast4 ? "UPI reference ending " + b.utrLast4 : inr(b.amount) },
      { done: confirmed, now: paid && !confirmed && b.status !== "cancelled", t: confirmed ? "Slot confirmed" : "Slot confirmation", s: confirmed ? b.confirmedSlot : "We confirm one of your slots within 2 to 4 hours during support hours." },
      { done: b.status === "completed", now: confirmed && b.status !== "completed", t: b.status === "completed" ? "Session completed" : "Your session", s: b.meetingLink ? "Room link below" : "The room link appears here once confirmed." }
    ];
    $("#bTitle").textContent = b.status === "cancelled" ? "Booking cancelled" : confirmed ? "You are all set" : paid ? "Booking received" : "Finish your payment";
    const msg = `Hi QIVA, about my booking ${b.id} (${b.itemName}).`;
    $("#bRoot").innerHTML = `<div class="grid2">
      <div class="stack-6" style="gap:18px">
        <div class="card"><div class="copyrow" style="justify-content:space-between"><span class="bid">${esc(b.id)}</span>${Q.bookingState(b)}</div>
          <ol class="timeline">${steps.map((x) => `<li class="${x.done ? "done" : x.now ? "now" : ""}"><span class="dot">${x.done ? tick : ""}</span><div><strong>${esc(x.t)}</strong><span>${esc(x.s)}</span></div></li>`).join("")}</ol>
          ${b.meetingLink ? `<a class="btn btn-dark" href="${esc(b.meetingLink)}" target="_blank" rel="noopener">Join your private room</a><span class="muted small">Open it at the confirmed time. ${esc(b.meetingLink)}</span>` : ""}
        </div>
        <div id="payBox"></div>
      </div>
      <div class="stack-6" style="gap:18px">
        <div class="card"><h3>Booking details</h3><dl class="kv"><dt>Booking</dt><dd>${esc(b.itemName)} · ${inr(b.amount)}</dd><dt>Track</dt><dd>${esc(b.trackName)}${b.focus ? " · " + esc(b.focus) : ""}</dd><dt>Topic</dt><dd>${esc(b.topic)}</dd><dt>Preferred slots</dt><dd>${b.slots.map((s) => esc(s.label)).join("<br>")}</dd><dt>Learner</dt><dd>${esc(b.name)}${b.isMinor ? " (under 18)" : ""}</dd></dl></div>
        <div class="card"><h3>Need help?</h3><p class="muted small">Quote your booking ID. For changes and refunds, see the <a href="/refund-policy">Refund &amp; Cancellation policy</a>.</p>
          <div class="copyrow"><a class="btn btn-sm" href="${esc(Q.wa(cfg, msg))}" target="_blank" rel="noopener">WhatsApp us</a><a class="btn btn-sm" href="/contact">Raise a ticket</a><button class="btn btn-sm btn-ghost" type="button" data-copy="${esc(location.href)}">Copy this page’s link</button></div></div>
      </div></div>`;
    if ((b.paymentStatus === "pending" || b.paymentStatus === "failed") && b.status !== "cancelled") payBox();
  }

  function payBox() {
    const box = $("#payBox");
    box.innerHTML = `<div class="card"><h3>Pay ${inr(b.amount)} to place your booking</h3>
      ${b.paymentStatus === "failed" ? '<p class="err">Your last online payment did not go through. You can try again or pay by UPI.</p>' : ""}
      ${cfg.cashfree.enabled ? `<button class="btn btn-dark" type="button" id="cfPay">Pay online: card, netbanking or UPI</button><span class="muted small">Secure checkout by Cashfree Payments.</span><p class="sectionlbl">Or pay to our UPI ID</p>` : ""}
      <div class="pay"><div class="qr" id="qrBox" role="img" aria-label="UPI QR code"></div><div class="stack-6" style="gap:10px;min-width:0"><span class="amount">${inr(b.amount)}</span><span class="upi">${esc(cfg.upiId)}</span>
        <div class="copyrow"><button class="btn btn-sm" type="button" data-copy="${esc(cfg.upiId)}">Copy UPI ID</button><a class="btn btn-sm" href="${esc(upiLink(b.amount))}">Open UPI app</a></div><span class="muted small">Add <span class="mono">${esc(b.id)}</span> as the payment note.</span></div></div>
      <div class="field"><label for="utr">12-digit UPI reference (UTR)</label><input class="input mono" id="utr" inputmode="numeric" maxlength="12" placeholder="Shown in your UPI app after paying"></div>
      <span class="err" id="payErr" role="alert"></span><button class="btn" type="button" id="utrSend" disabled>Submit payment reference</button></div>`;
    try { if (window.QRCode) new window.QRCode($("#qrBox"), { text: upiLink(b.amount), width: 184, height: 184, colorDark: "#17150F", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M }); } catch (e) { /* QR optional */ }
    $("#utr").addEventListener("input", (e) => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 12); $("#utrSend").disabled = e.target.value.length !== 12; });
    $("#utrSend").addEventListener("click", async () => {
      try { const r = await api(`/api/bookings/${encodeURIComponent(b.id)}/utr`, { method: "POST", body: { token, utr: $("#utr").value } }); b = r.booking; render(); Q.toast("Payment reference received"); }
      catch (x) { $("#payErr").textContent = x.message; }
    });
    const cfBtn = $("#cfPay");
    if (cfBtn) cfBtn.addEventListener("click", startCashfree);
    if (cfBtn && params.get("pay") === "1") { history.replaceState(null, "", location.pathname + "?t=" + encodeURIComponent(token)); startCashfree(); }
  }

  async function startCashfree() {
    const btn = $("#cfPay"); if (btn) { btn.disabled = true; btn.textContent = "Opening secure checkout…"; }
    try {
      const r = await api(`/api/bookings/${encodeURIComponent(b.id)}/cashfree`, { method: "POST", body: { token } });
      if (typeof window.Cashfree !== "function") throw new Error("The payment window could not load. Check your connection or pay by UPI.");
      window.Cashfree({ mode: r.mode }).checkout({ paymentSessionId: r.paymentSessionId, redirectTarget: "_self" });
    } catch (x) { $("#payErr").textContent = x.message; if (btn) { btn.disabled = false; btn.textContent = "Pay online: card, netbanking or UPI"; } }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    cfg = await Q.config();
    try {
      if (params.get("order_id")) $("#bRoot").innerHTML = '<p class="muted">Checking your payment with Cashfree…</p>';
      const r = await api(`/api/bookings/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`);
      b = r.booking;
      Q.local.add({ id: b.id, token, itemName: b.itemName, amount: b.amount, createdAt: Date.parse(b.createdAt) || Date.now() });
      render();
    } catch (x) {
      $("#bTitle").textContent = "Booking not found";
      $("#bRoot").innerHTML = `<div class="card"><p>${esc(x.message)}</p><div class="copyrow"><a class="btn btn-dark" href="/account">See my bookings</a><a class="btn" href="/contact">Contact us</a></div></div>`;
    }
  });
})();
