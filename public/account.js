/* /account and /reset-password */
(function () {
  "use strict";
  const Q = window.QIVA;
  const { $, esc, inr, api } = Q;
  let root;

  const field = (id, label, type, extra) => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" type="${type || "text"}" ${extra || ""}></div>`;

  function bookingRows(list) {
    if (!list.length) return `<p class="muted">No bookings yet. <a href="/#book">Book your first session</a>.</p>`;
    return `<div class="blist">${list.map((b) => `<div class="bitem"><div class="meta"><strong>${esc(b.itemName)} · ${inr(b.amount)}</strong><span class="mono">${esc(b.id)}</span><span>${esc(b.trackName || "")}${b.confirmedSlot ? " · " + esc(b.confirmedSlot) : ""}</span></div>
      <div class="copyrow">${Q.bookingState(b)}<a class="btn btn-sm" href="/booking/${encodeURIComponent(b.id)}?t=${encodeURIComponent(b.token)}">Open</a></div></div>`).join("")}</div>`;
  }

  async function deviceBookings(el) {
    const saved = Q.local.get();
    if (!saved.length) { el.innerHTML = `<p class="muted">Bookings you make on this device appear here, even without an account.</p>`; return; }
    el.innerHTML = `<p class="muted">Checking ${saved.length} booking${saved.length > 1 ? "s" : ""}…</p>`;
    const rows = await Promise.all(saved.map((s) => api(`/api/bookings/${encodeURIComponent(s.id)}?t=${encodeURIComponent(s.token)}`).then((r) => ({ ...r.booking, token: s.token })).catch(() => null)));
    el.innerHTML = bookingRows(rows.filter(Boolean));
  }

  function signedOut(mode) {
    $("#accTitle").textContent = mode === "signup" ? "Create your account" : "Sign in";
    root.innerHTML = `<div class="grid2">
      <div class="card auth"><div class="tabs" role="tablist"><button role="tab" type="button" data-m="signin" aria-selected="${mode !== "signup"}">Sign in</button><button role="tab" type="button" data-m="signup" aria-selected="${mode === "signup"}">Create account</button></div>
      ${mode === "signup" ? `<form id="fSignup" class="stack-6" style="gap:14px" novalidate>
          ${field("sName", "Full name", "text", 'autocomplete="name"')}
          <div class="two">${field("sEmail", "Email", "email", 'autocomplete="email"')}${field("sPhone", "Mobile (WhatsApp)", "tel", 'inputmode="numeric" autocomplete="tel"')}</div>
          ${field("sPass", "Password", "password", 'autocomplete="new-password" minlength="8"')}
          <div class="field"><span class="lbl">Your age</span><div class="radios" id="sAge"><label><input type="radio" name="sAge" value="adult" checked>18 or older</label><label><input type="radio" name="sAge" value="minor">Under 18</label></div></div>
          <div class="guardian" id="sGuardian" hidden><span class="hd">Parent or guardian</span><span class="muted small">Learners under 18 need a parent or guardian’s consent. We confirm with them before the first session.</span>
            <div class="two">${field("sGName", "Parent or guardian’s name")}${field("sGPhone", "Their mobile number", "tel", 'inputmode="numeric"')}</div>${field("sGEmail", "Their email (optional)", "email")}
            <label class="check"><input type="checkbox" id="sGConsent"><span>I am the parent or lawful guardian, I am 18 or older, and I consent to QIVA processing my child’s details as described in the <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label></div>
          <label class="check"><input type="checkbox" id="sTerms"><span>I agree to the <a href="/terms" target="_blank">Terms</a> and <a href="/privacy" target="_blank">Privacy Policy</a>.</span></label>
          <span class="err" id="fErr" role="alert"></span><button class="btn btn-dark" type="submit">Create account</button></form>`
        : `<form id="fSignin" class="stack-6" style="gap:14px" novalidate>${field("lEmail", "Email", "email", 'autocomplete="email"')}${field("lPass", "Password", "password", 'autocomplete="current-password"')}
          <span class="err" id="fErr" role="alert"></span><button class="btn btn-dark" type="submit">Sign in</button>
          <button class="linkbtn" type="button" id="forgotBtn">Forgot your password?</button></form>
          <form id="fForgot" class="stack-6" style="gap:12px" hidden novalidate><p class="muted small">Enter your email and we will send a reset link.</p>${field("fEmail", "Email", "email", 'autocomplete="email"')}<span class="err" id="fgErr" role="alert"></span><button class="btn" type="submit">Send reset link</button></form>`}
      </div>
      <div class="card"><h3>Bookings on this device</h3><div id="devList"></div><p class="muted small">You do not need an account to book. An account keeps all your bookings in one place on any device.</p></div></div>`;
    root.querySelectorAll("[data-m]").forEach((b) => b.addEventListener("click", () => signedOut(b.dataset.m)));
    deviceBookings($("#devList"));
    const err = (m) => { $("#fErr").textContent = m; };
    if (mode === "signup") {
      $("#sAge").addEventListener("change", (e) => { $("#sGuardian").hidden = e.target.value !== "minor"; });
      $("#fSignup").addEventListener("submit", async (e) => {
        e.preventDefault();
        const minor = root.querySelector('input[name="sAge"]:checked').value === "minor";
        const body = { name: $("#sName").value, email: $("#sEmail").value, phone: $("#sPhone").value, password: $("#sPass").value, isMinor: minor,
          guardianName: minor ? $("#sGName").value : "", guardianPhone: minor ? $("#sGPhone").value : "", guardianEmail: minor ? $("#sGEmail").value.trim() : "", guardianConsent: minor && $("#sGConsent").checked, acceptTerms: $("#sTerms").checked };
        if (!body.acceptTerms) return err("Please accept the Terms and Privacy Policy.");
        try { await api("/api/auth/signup", { method: "POST", body }); location.reload(); } catch (x) { err(x.message); }
      });
    } else {
      $("#fSignin").addEventListener("submit", async (e) => {
        e.preventDefault();
        try { await api("/api/auth/login", { method: "POST", body: { email: $("#lEmail").value, password: $("#lPass").value } }); location.reload(); } catch (x) { err(x.message); }
      });
      $("#forgotBtn").addEventListener("click", () => { $("#fForgot").hidden = false; $("#fEmail").value = $("#lEmail").value; $("#fEmail").focus(); });
      $("#fForgot").addEventListener("submit", async (e) => {
        e.preventDefault();
        try {
          const r = await api("/api/auth/forgot", { method: "POST", body: { email: $("#fEmail").value } });
          const c = await Q.config();
          $("#fForgot").innerHTML = r.emailEnabled ? `<p class="done-box">If that email has an account, a reset link is on its way. It works for one hour.</p>` : `<p class="note">Email is not set up yet. Message us on WhatsApp at ${esc(c.whatsappDisplay)} and we will reset your password.</p>`;
        } catch (x) { $("#fgErr").textContent = x.message; }
      });
    }
  }

  async function signedIn(user) {
    if (user.role === "admin") { $("#accTitle").textContent = "Welcome back"; root.innerHTML = `<div class="card"><p>You are signed in as an admin.</p><div class="copyrow"><a class="btn btn-dark" href="/admin">Open the admin panel</a><button class="btn" type="button" id="outBtn">Sign out</button></div></div>`; bindOut(); return; }
    $("#accTitle").textContent = "Hi, " + user.name.split(" ")[0];
    root.innerHTML = `<div class="grid2">
      <div class="card"><div class="copyrow" style="justify-content:space-between"><h2>Your bookings</h2><a class="btn btn-dark btn-sm" href="/#book">Book a session</a></div><div id="myList"><p class="muted">Loading…</p></div></div>
      <div class="stack-6" style="gap:18px">
        <div class="card"><h3>Your details</h3><dl class="kv"><dt>Name</dt><dd>${esc(user.name)}</dd><dt>Email</dt><dd>${esc(user.email)}</dd><dt>Mobile</dt><dd>${esc(user.phone ? "+91 " + user.phone : "")}</dd>${user.isMinor ? `<dt>Guardian</dt><dd>${esc(user.guardianName)} · +91 ${esc(user.guardianPhone)}</dd>` : ""}</dl>
          <button class="btn btn-sm" type="button" id="outBtn">Sign out</button></div>
        <div class="card"><h3>Your data and privacy</h3><p class="muted small">Under the Digital Personal Data Protection Act you can ask for a copy of your data, correct it, delete it or withdraw consent. We reply within 90 days, usually much sooner.</p>
          <div class="radios" id="drType"><label><input type="radio" name="dr" value="access" checked>Copy of my data</label><label><input type="radio" name="dr" value="correction">Correct my details</label><label><input type="radio" name="dr" value="deletion">Delete my account</label><label><input type="radio" name="dr" value="withdraw_consent">Withdraw consent</label></div>
          <div class="field"><label for="drDetails">Details <span class="muted">(optional)</span></label><textarea class="input" id="drDetails" maxlength="2000"></textarea></div>
          <span class="err" id="drErr" role="alert"></span><button class="btn" type="button" id="drSend">Send request</button><div id="drDone" hidden class="done-box"></div></div>
      </div></div>`;
    bindOut();
    try {
      const r = await api("/api/me/bookings");
      const mine = r.bookings, ids = new Set(mine.map((b) => b.id));
      const extra = Q.local.get().filter((s) => !ids.has(s.id));
      $("#myList").innerHTML = bookingRows(mine) + (extra.length ? `<p class="sectionlbl">Also booked on this device</p><div id="devList"></div>` : "");
      if (extra.length) deviceBookings($("#devList"));
    } catch (x) { $("#myList").innerHTML = `<p class="err">${esc(x.message)}</p>`; }
    $("#drSend").addEventListener("click", async () => {
      const type = root.querySelector('input[name="dr"]:checked').value;
      try {
        const r = await api("/api/me/data-request", { method: "POST", body: { type, details: $("#drDetails").value } });
        $("#drDone").hidden = false; $("#drDone").innerHTML = `<strong>${esc(r.id)}</strong><span>Your request is logged. We will reply on email.</span>`; $("#drSend").hidden = true;
      } catch (x) { $("#drErr").textContent = x.message; }
    });
  }
  function bindOut() { const b = $("#outBtn"); if (b) b.addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {}); location.href = "/account"; }); }

  function resetForm() {
    const token = new URLSearchParams(location.search).get("token") || "";
    root.innerHTML = `<form class="card auth" id="fReset" novalidate>${field("rPass", "New password", "password", 'autocomplete="new-password" minlength="8"')}${field("rPass2", "Repeat the new password", "password", 'autocomplete="new-password"')}<span class="err" id="rErr" role="alert"></span><button class="btn btn-dark" type="submit">Save new password</button></form>`;
    $("#fReset").addEventListener("submit", async (e) => {
      e.preventDefault();
      if ($("#rPass").value !== $("#rPass2").value) { $("#rErr").textContent = "The two passwords do not match."; return; }
      try { await api("/api/auth/reset", { method: "POST", body: { token, password: $("#rPass").value } }); location.href = "/account"; } catch (x) { $("#rErr").textContent = x.message; }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    root = $("#accRoot");
    if (root.dataset.mode === "reset") return resetForm();
    const c = await Q.config();
    if (c.user) signedIn(c.user); else signedOut(new URLSearchParams(location.search).get("mode") === "signup" ? "signup" : "signin");
  });
})();
