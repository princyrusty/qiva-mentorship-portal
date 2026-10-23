/* Booking modal: choose, describe, schedule, pay. Talks to /api/bookings. */
(function () {
  "use strict";
  const Q = window.QIVA, C = window.QIVA_CATALOG;
  const { $, $$, esc, inr, api } = Q;
  const tIco = (p) => `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const STEPS = ["What would you like to book?", "What do you need help with?", "Pick slots and add your details", "Pay to place your booking", "Booking placed"];
  const NEXT = ["Continue", "Choose slots", "Continue to payment", "Place booking", "Close"];
  const DAYS = C.upcomingDays(8);
  const B = {};
  let step = 0, lastFocus = null, created = null, createdKey = "", busy = false, cfg = { user: null, cashfree: { enabled: false } };

  function reset() {
    Object.assign(B, { kind: "single", item: "s60", track: "", focus: "", about: "", topic: "", notes: "", day: 0, slots: [], name: "", phone: "", email: "",
      isMinor: false, guardianName: "", guardianPhone: "", guardianEmail: "", guardianConsent: false, acceptTerms: false, utr: "", paid: false });
    created = null; createdKey = "";
    const u = cfg.user;
    if (u && u.role !== "admin") Object.assign(B, { name: u.name || "", phone: u.phone || "", email: u.email || "", isMinor: !!u.isMinor, guardianName: u.guardianName || "", guardianPhone: u.guardianPhone || "", guardianEmail: u.guardianEmail || "", guardianConsent: !!u.isMinor });
  }
  Q.config().then((c) => { cfg = c; });

  function moveKnob(seg) {
    if (!seg) return;
    const on = seg.querySelector('[aria-pressed="true"]'), k = seg.querySelector(".knob");
    if (!on || !k) return;
    k.style.width = on.offsetWidth + "px"; k.style.transform = `translateX(${on.offsetLeft - 5}px)`;
  }
  Q.moveKnob = moveKnob;

  function open(o) {
    o = o || {};
    reset();
    if (o.item && C.item(o.item)) { B.item = o.item; B.kind = C.isPlan(o.item) ? "plan" : "single"; }
    if (o.track) B.track = o.track;
    if (o.focus) { B.focus = o.focus; B.topic = o.focus; }
    if (o.topic) B.topic = o.topic;
    step = o.item ? 1 : 0;
    lastFocus = document.activeElement;
    $("#bookModal").hidden = false;
    document.body.style.overflow = "hidden";
    render();
    setTimeout(() => $("#bkClose").focus(), 30);
  }
  function close() {
    $("#bookModal").hidden = true;
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  Q.openBooking = open;

  const slotLabel = (s) => C.slotLabel(s);
  function keep() {
    if (step === 1) { B.about = $("#bkAbout").value; B.topic = $("#bkTopic").value.trim(); B.notes = $("#bkNotes").value.trim(); }
    if (step === 2) {
      B.name = $("#bkName").value.trim(); B.phone = $("#bkPhone").value.replace(/\D/g, "").replace(/^(?:91|0)(?=\d{10}$)/, ""); B.email = $("#bkEmail").value.trim();
      B.acceptTerms = $("#bkTerms").checked;
      if (B.isMinor) { B.guardianName = $("#bkGName").value.trim(); B.guardianPhone = $("#bkGPhone").value.replace(/\D/g, "").replace(/^(?:91|0)(?=\d{10}$)/, ""); B.guardianEmail = $("#bkGEmail").value.trim(); B.guardianConsent = $("#bkGConsent").checked; }
    }
  }
  const payload = () => ({ itemId: B.item, track: B.track, focus: B.focus, about: B.about, topic: B.topic, notes: B.notes, slots: B.slots.map((s) => ({ date: s.date, time: s.time })),
    name: B.name, phone: B.phone, email: B.email, isMinor: B.isMinor, guardianName: B.guardianName, guardianPhone: B.guardianPhone, guardianEmail: B.guardianEmail, guardianConsent: B.guardianConsent, acceptTerms: B.acceptTerms });

  function render() {
    $("#bkErr").textContent = "";
    $("#bkStep").textContent = step < 4 ? `Step ${step + 1} of 4` : "Done";
    $("#bkTitle").textContent = STEPS[step];
    $$("#bkProg i").forEach((x, i) => x.classList.toggle("on", i <= step));
    $("#bkBack").hidden = step === 0 || step === 4;
    const next = $("#bkNext"); next.disabled = false; next.textContent = NEXT[step];
    const body = $("#bkBody");
    body.onclick = null;

    if (step === 0) {
      const list = B.kind === "plan" ? C.PLANS : C.SINGLE;
      body.innerHTML = `<div class="seg" id="bkSeg" role="group" aria-label="Booking type"><span class="knob"></span><button type="button" data-k="plan" aria-pressed="${B.kind === "plan"}">Monthly plan</button><button type="button" data-k="single" aria-pressed="${B.kind === "single"}">Single session</button></div>
        <div class="opts">${list.map((p) => `<button class="opt" type="button" data-pick="${p.id}" aria-pressed="${B.item === p.id}"><span><strong>${esc(p.name)}${C.isPlan(p.id) ? " plan" : ""}</strong><span>${C.isPlan(p.id) ? `4 × ${p.mins} min a month · ${inr(p.per)} per session` : `${p.mins} minutes, ${p.mode}`}</span></span><span class="p">${inr(p.price)}</span></button>`).join("")}</div>
        <p class="muted small">Prices include GST. Not sure? A single 60 minute session is a good first step.</p>`;
      moveKnob($("#bkSeg"));
      body.onclick = (e) => {
        const k = e.target.closest("[data-k]");
        if (k) { B.kind = k.dataset.k; B.item = B.kind === "plan" ? "pragati" : "s60"; return render(); }
        const p = e.target.closest("[data-pick]");
        if (p) { B.item = p.dataset.pick; $$("#bkBody [data-pick]").forEach((x) => x.setAttribute("aria-pressed", String(x === p))); }
      };
    }

    if (step === 1) {
      const it = C.item(B.item), tr = C.track(B.track);
      body.innerHTML = `<div class="summary"><div class="r"><span>Booking</span><span>${esc(it.name)}${C.isPlan(B.item) ? " plan" : ""} · ${inr(it.price)}</span></div></div>
        <div class="field"><span class="lbl">Mentorship track</span><div class="tgrid">${C.TRACKS.map((t) => `<button class="tbtn" type="button" data-tr="${t.id}" aria-pressed="${t.id === B.track}">${tIco(t.icon)}<span>${esc(t.name)}</span></button>`).join("")}</div></div>
        ${tr ? `<div class="field"><span class="lbl">Focus area</span><div class="focus">${tr.focus.map((f) => `<button class="chip" type="button" data-fo="${esc(f)}" aria-pressed="${f === B.focus}">${esc(f)}</button>`).join("")}</div>${tr.note ? `<p class="note">${tr.note}</p>` : ""}</div>` : ""}
        <div class="two"><div class="field"><label for="bkAbout">About you</label><select class="input" id="bkAbout"><option value="">Choose one</option>${C.ABOUT.map((a) => `<option${a === B.about ? " selected" : ""}>${esc(a)}</option>`).join("")}</select></div>
        <div class="field"><label for="bkTopic">What exactly do you want help with?</label><input class="input" id="bkTopic" type="text" maxlength="300" value="${esc(B.topic)}" placeholder="${tr ? esc("For example: " + tr.focus[0]) : "Describe it in one sentence"}"></div></div>
        <div class="field"><label for="bkNotes">Anything else your mentor should know? <span class="muted">(optional)</span></label><textarea class="input" id="bkNotes" maxlength="1000" placeholder="What you have tried, or what feels stuck. Two or three lines help.">${esc(B.notes)}</textarea></div>`;
      body.onclick = (e) => {
        const t = e.target.closest("[data-tr]");
        if (t) { keep(); B.track = t.dataset.tr; B.focus = ""; return render(); }
        const f = e.target.closest("[data-fo]");
        if (f) { B.focus = f.dataset.fo; $$("#bkBody [data-fo]").forEach((x) => x.setAttribute("aria-pressed", String(x === f))); if (!$("#bkTopic").value.trim()) $("#bkTopic").value = B.focus; }
      };
    }

    if (step === 2) {
      const d = DAYS[B.day];
      body.innerHTML = `<div class="field"><span class="lbl">Day <span class="muted">· times in IST</span></span><div class="days">${DAYS.map((x, i) => `<button class="day${B.slots.some((s) => s.date === x.key) ? " has" : ""}" type="button" data-day="${i}" aria-pressed="${i === B.day}"><span>${x.wd}</span><b>${x.day}</b><span>${x.mon}</span><i class="dot"></i></button>`).join("")}</div></div>
        <div class="field"><span class="lbl">Time</span><div class="times">${C.slotTimes(d.weekend).map((t) => `<button class="chip" type="button" data-time="${t}" aria-pressed="${B.slots.some((s) => s.date === d.key && s.time === t)}">${t}</button>`).join("")}</div></div>
        <div class="picked"><span class="muted small">Picked ${B.slots.length} of 2:</span>${B.slots.map((s, i) => `<span class="tag">${esc(slotLabel(s))} <button type="button" data-rm="${i}" aria-label="Remove ${esc(slotLabel(s))}" class="tag-x">×</button></span>`).join("") || '<span class="muted small">none yet</span>'}</div>
        <div class="two"><div class="field"><label for="bkName">Learner’s name</label><input class="input" id="bkName" autocomplete="name" value="${esc(B.name)}"></div>
        <div class="field"><label for="bkPhone">WhatsApp number</label><input class="input" id="bkPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10-digit mobile number" value="${esc(B.phone)}"></div></div>
        <div class="field"><label for="bkEmail">Email <span class="muted">(for your confirmation and notes)</span></label><input class="input" id="bkEmail" type="email" autocomplete="email" value="${esc(B.email)}"></div>
        <div class="field"><span class="lbl">Learner’s age</span><div class="radios" id="bkAge"><label><input type="radio" name="bkAge" value="adult"${B.isMinor ? "" : " checked"}>18 or older</label><label><input type="radio" name="bkAge" value="minor"${B.isMinor ? " checked" : ""}>Under 18</label></div></div>
        ${B.isMinor ? `<div class="guardian"><span class="hd">Parent or guardian</span><span class="muted small">For learners under 18 we need a parent or guardian’s consent. We confirm with them before the first session.</span>
          <div class="two"><div class="field"><label for="bkGName">Parent or guardian’s name</label><input class="input" id="bkGName" value="${esc(B.guardianName)}"></div><div class="field"><label for="bkGPhone">Their mobile number</label><input class="input" id="bkGPhone" type="tel" inputmode="numeric" value="${esc(B.guardianPhone)}"></div></div>
          <div class="field"><label for="bkGEmail">Their email <span class="muted">(optional)</span></label><input class="input" id="bkGEmail" type="email" value="${esc(B.guardianEmail)}"></div>
          <label class="check"><input type="checkbox" id="bkGConsent"${B.guardianConsent ? " checked" : ""}><span>I am the parent or lawful guardian, I am 18 or older, and I consent to QIVA processing my child’s details for this mentorship as described in the <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label></div>` : ""}
        <label class="check"><input type="checkbox" id="bkTerms"${B.acceptTerms ? " checked" : ""}><span>I agree to the <a href="/terms" target="_blank">Terms</a>, <a href="/privacy" target="_blank">Privacy Policy</a> and <a href="/refund-policy" target="_blank">Refund policy</a>.</span></label>`;
      body.onclick = (e) => {
        const dd = e.target.closest("[data-day]");
        if (dd) { keep(); B.day = +dd.dataset.day; return render(); }
        const tt = e.target.closest("[data-time]");
        if (tt) {
          keep();
          const k = DAYS[B.day].key, t = tt.dataset.time, i = B.slots.findIndex((s) => s.date === k && s.time === t);
          if (i >= 0) B.slots.splice(i, 1);
          else { if (B.slots.length >= 2) { $("#bkErr").textContent = "You can pick two slots. Remove one to add another."; return; } B.slots.push({ date: k, time: t }); }
          return render();
        }
        const rm = e.target.closest("[data-rm]");
        if (rm) { keep(); B.slots.splice(+rm.dataset.rm, 1); return render(); }
      };
      $("#bkAge").addEventListener("change", (e) => { keep(); B.isMinor = e.target.value === "minor"; render(); });
    }

    if (step === 3) {
      body.innerHTML = `<p class="muted">Reserving your booking…</p>`;
      next.disabled = true;
      ensureCreated().then(() => renderPay()).catch((err) => {
        body.innerHTML = `<p class="err">${esc(err.message)}</p><p class="muted small">Go back to fix the details, then try again.</p>`;
      });
    }

    if (step === 4) {
      const it = C.item(B.item), tr = C.track(B.track);
      const statusUrl = location.origin + created.statusUrl;
      const msg = `Hi QIVA, I have paid and want to confirm my booking.\nBooking ID: ${created.id}\nBooking: ${it.name}${C.isPlan(B.item) ? " plan" : ""} (${inr(it.price)})\nTrack: ${tr.name}${B.focus ? " · " + B.focus : ""}\nSlots (IST): ${B.slots.map(slotLabel).join("; ")}\nName: ${B.name}\nUPI reference: ${B.utr}\nBooking page: ${statusUrl}\n\nI will attach the payment screenshot.`;
      body.innerHTML = `<div class="done"><span class="status st-info">Payment being verified</span><span class="bid">${esc(created.id)}</span>
        <p>We have your payment reference. We verify it and confirm one of your slots within 2 to 4 hours during support hours${B.email ? ", by WhatsApp and email" : ", on WhatsApp"}.</p>
        <div class="copyrow"><a class="btn btn-dark" href="${esc(created.statusUrl)}">Open your booking page</a><a class="btn" href="${esc(Q.wa(cfg, msg))}" target="_blank" rel="noopener">Send it on WhatsApp</a><button class="btn btn-ghost" type="button" data-copy="${esc(statusUrl)}">Copy booking link</button></div>
        <p class="muted small">Keep the booking link: it shows your status, confirmed slot and private room link. This booking is also saved on this device${cfg.user ? " and in your account" : ""}.</p></div>`;
    }
  }

  async function ensureCreated() {
    const p = payload(), key = JSON.stringify(p);
    if (created && createdKey === key) return created;
    created = await api("/api/bookings", { method: "POST", body: p });
    createdKey = key;
    Q.local.add({ id: created.id, token: created.token, itemName: created.itemName, amount: created.amount, createdAt: Date.now() });
    return created;
  }

  function renderPay() {
    const it = C.item(B.item), tr = C.track(B.track), body = $("#bkBody");
    body.innerHTML = `<div class="summary"><div class="r"><span>Booking</span><span>${esc(it.name)}${C.isPlan(B.item) ? " plan" : ""}</span></div><div class="r"><span>Track</span><span>${esc(tr.name)}${B.focus ? " · " + esc(B.focus) : ""}</span></div><div class="r"><span>Slots</span><span>${B.slots.map((s) => esc(slotLabel(s))).join("<br>")}</span></div><div class="r"><span>Booking ID</span><span class="mono">${esc(created.id)}</span></div></div>
      <div class="pay"><div class="qr" id="qrBox" role="img" aria-label="UPI QR code for ${inr(created.amount)}"></div>
        <div class="stack-6" style="gap:10px;min-width:0"><span class="eyebrow">Pay with any UPI app</span><span class="amount">${inr(created.amount)}</span><span class="upi">${esc(created.upi.id)}</span>
          <div class="copyrow"><button class="btn btn-sm" type="button" data-copy="${esc(created.upi.id)}">Copy UPI ID</button><a class="btn btn-sm" href="${esc(created.upi.link)}">Open UPI app</a></div>
          <span class="muted small">Add <span class="mono">${esc(created.id)}</span> as the payment note. “Open UPI app” works only on some phones; the QR code and UPI ID always work.</span></div></div>
      ${created.cashfree.enabled
        ? `<div class="soon">${tIco('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>')}<span><strong>Prefer cards or netbanking?</strong> <a href="${esc(created.statusUrl)}&pay=1">Pay online with Cashfree</a> instead. You will come back to your booking page after paying.</span></div>`
        : `<div class="soon">${tIco('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}<span><strong>Online payment gateway coming very soon.</strong> Cards, netbanking and automatic monthly billing will be added here. For now, UPI is the way to pay.</span></div>`}
      <div class="field"><label for="bkUtr">12-digit UPI reference (UTR)</label><input class="input mono" id="bkUtr" type="text" inputmode="numeric" maxlength="12" placeholder="Shown in your UPI app after paying" value="${esc(B.utr)}"></div>
      <label class="check"><input type="checkbox" id="bkPaid"${B.paid ? " checked" : ""}><span>I have paid ${inr(created.amount)} to ${esc(created.upi.id)}</span></label>`;
    try {
      if (window.QRCode) new window.QRCode($("#qrBox"), { text: created.upi.link, width: 184, height: 184, colorDark: "#17150F", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M });
      else $("#qrBox").innerHTML = '<span class="muted small" style="line-height:1.4;padding:8px">QR code could not load. Pay to the UPI ID shown.</span>';
    } catch (e) { $("#qrBox").innerHTML = '<span class="muted small">Pay to the UPI ID shown.</span>'; }
    const v = () => { B.utr = $("#bkUtr").value.replace(/\D/g, "").slice(0, 12); $("#bkUtr").value = B.utr; B.paid = $("#bkPaid").checked; $("#bkNext").disabled = !(B.paid && B.utr.length === 12) || busy; };
    $("#bkUtr").addEventListener("input", v); $("#bkPaid").addEventListener("change", v); v();
  }

  function validate() {
    const err = (m) => { $("#bkErr").textContent = m; return false; };
    if (step === 1) { if (!B.track) return err("Choose a track."); if (!B.about) return err("Tell us who the learner is."); if (B.topic.length < 4) return err("Describe what you want help with."); }
    if (step === 2) {
      if (!B.slots.length) return err("Pick at least one slot.");
      if (B.name.length < 2) return err("Add the learner’s name.");
      if (!/^[6-9]\d{9}$/.test(B.phone)) return err("Enter a 10-digit Indian mobile number.");
      if (B.email && !/^\S+@\S+\.\S+$/.test(B.email)) return err("Check the email address.");
      if (B.isMinor) {
        if (B.guardianName.length < 2) return err("Add the parent or guardian’s name.");
        if (!/^[6-9]\d{9}$/.test(B.guardianPhone)) return err("Add the parent or guardian’s 10-digit mobile number.");
        if (!B.guardianConsent) return err("A parent or guardian must give consent for learners under 18.");
      }
      if (!B.acceptTerms) return err("Please accept the Terms, Privacy Policy and Refund policy.");
    }
    if (step === 3 && !(B.paid && B.utr.length === 12)) return err("Pay first, then enter the 12-digit UPI reference.");
    return true;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!$("#bookModal")) return;
    $$("[data-book]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); open(); }));
    $("#bkClose").addEventListener("click", close);
    $("#bookModal").addEventListener("click", (e) => { if (e.target.id === "bookModal") close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#bookModal").hidden) close(); });
    $("#bkBack").addEventListener("click", () => { keep(); step = Math.max(0, step - 1); render(); });
    $("#bkNext").addEventListener("click", async () => {
      keep();
      if (step === 4) return close();
      if (!validate()) return;
      if (step === 3) {
        busy = true; $("#bkNext").disabled = true; $("#bkNext").textContent = "Placing booking…";
        try { await api(`/api/bookings/${encodeURIComponent(created.id)}/utr`, { method: "POST", body: { token: created.token, utr: B.utr } }); }
        catch (e) { busy = false; $("#bkErr").textContent = e.message; $("#bkNext").textContent = NEXT[3]; $("#bkNext").disabled = false; return; }
        busy = false;
      }
      step++; render(); $("#bkBody").scrollTop = 0;
    });
    if (location.hash === "#book") { history.replaceState(null, "", location.pathname); Q.config().then(() => open()); }
  });
})();
