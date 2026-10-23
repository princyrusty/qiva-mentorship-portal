/* /admin — owner dashboard */
(function () {
  "use strict";
  const Q = window.QIVA, C = window.QIVA_CATALOG;
  const { $, $$, esc, inr, api } = Q;
  let root, cfg, tab = "overview", filter = "verify", query = "", cache = {};

  const field = (id, label, type, extra) => `<div class="field"><label for="${id}">${label}</label><input class="input" id="${id}" type="${type || "text"}" ${extra || ""}></div>`;
  const ago = (d) => { const m = Math.round((Date.now() - Date.parse(d)) / 60000); return m < 60 ? m + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : Math.round(m / 1440) + " d ago"; };

  /* ---------- sign in / first-run setup ---------- */
  async function gate() {
    const s = await api("/api/admin/setup-status");
    if (s.needsSetup) {
      root.innerHTML = `<div class="page-head"><span class="eyebrow">First-time setup</span><h1>Create the owner account</h1><p class="lede">This runs once. Use the ADMIN_SETUP_CODE from your Render environment settings.</p></div>
        <form class="card auth" id="fSetup" novalidate>${s.codeConfigured ? "" : '<p class="err">ADMIN_SETUP_CODE is not set on the server yet.</p>'}
        ${field("suCode", "Setup code", "password", 'autocomplete="off"')}${field("suName", "Your name", "text", 'autocomplete="name"')}${field("suEmail", "Your email", "email", 'autocomplete="email"')}${field("suPass", "Owner password (10 or more characters)", "password", 'autocomplete="new-password"')}
        <span class="err" id="suErr" role="alert"></span><button class="btn btn-dark" type="submit">Create owner account</button></form>`;
      $("#fSetup").addEventListener("submit", async (e) => {
        e.preventDefault();
        try { await api("/api/admin/setup", { method: "POST", body: { code: $("#suCode").value, name: $("#suName").value, email: $("#suEmail").value, password: $("#suPass").value } }); location.reload(); }
        catch (x) { $("#suErr").textContent = x.message; }
      });
      return;
    }
    root.innerHTML = `<div class="page-head"><span class="eyebrow">Admin</span><h1>Sign in</h1></div>
      <form class="card auth" id="fLogin" novalidate>${field("alEmail", "Email", "email", 'autocomplete="email"')}${field("alPass", "Password", "password", 'autocomplete="current-password"')}<span class="err" id="alErr" role="alert"></span><button class="btn btn-dark" type="submit">Sign in</button></form>`;
    $("#fLogin").addEventListener("submit", async (e) => {
      e.preventDefault();
      try { await api("/api/auth/login", { method: "POST", body: { email: $("#alEmail").value, password: $("#alPass").value } }); location.reload(); }
      catch (x) { $("#alErr").textContent = x.message; }
    });
  }

  /* ---------- shell ---------- */
  const TABS = [["overview", "Overview"], ["bookings", "Bookings"], ["applications", "Mentor applications"], ["messages", "Messages"], ["people", "People"]];
  function shell() {
    root.innerHTML = `<div class="admin-top"><div class="stack-6"><span class="eyebrow">QIVA Mentorship</span><h1>Admin</h1></div>
        <div class="copyrow"><details class="menu-export"><summary class="btn btn-sm">Export CSV</summary><div class="export-list"><a href="/api/admin/export/bookings">Bookings</a><a href="/api/admin/export/applications">Applications</a><a href="/api/admin/export/messages">Messages</a><a href="/api/admin/export/users">People</a></div></details><button class="btn btn-sm" type="button" id="outBtn">Sign out</button></div></div>
      <div class="atabs" role="tablist">${TABS.map(([k, l]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${tab === k}">${l}<span class="count" data-count="${k}" hidden></span></button>`).join("")}</div>
      <div id="view"></div>
      <div class="detail" id="detail" hidden><div class="detail-panel" role="dialog" aria-modal="true" aria-labelledby="dTitle"><div class="dhead"><div class="r"><div class="stack-6"><span class="eyebrow" id="dKind"></span><h2 id="dTitle"></h2></div><button class="iconbtn" type="button" id="dClose" aria-label="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div></div><div class="dbody" id="dBody"></div></div></div>`;
    $$(".atabs [data-tab]").forEach((b) => b.addEventListener("click", () => go(b.dataset.tab)));
    $("#outBtn").addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST", body: {} }).catch(() => {}); location.href = "/admin"; });
    $("#dClose").addEventListener("click", closeDetail);
    $("#detail").addEventListener("click", (e) => { if (e.target.id === "detail") closeDetail(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("#detail").hidden) closeDetail(); });
  }
  function go(t, keepHash) {
    tab = t;
    $$(".atabs [data-tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === t)));
    if (!keepHash) history.replaceState(null, "", "#" + t);
    ({ overview, bookings, applications, messages, people })[t]();
  }
  function closeDetail() { $("#detail").hidden = true; if (location.hash.startsWith("#booking=")) history.replaceState(null, "", "#bookings"); }
  function openDetail(kind, title, html) { $("#dKind").textContent = kind; $("#dTitle").textContent = title; $("#dBody").innerHTML = html; $("#detail").hidden = false; $("#dClose").focus(); }

  /* ---------- overview ---------- */
  async function overview() {
    const v = $("#view"); v.innerHTML = `<p class="muted">Loading…</p>`;
    const s = await api("/api/admin/summary");
    const badge = (k, n) => { const el = root.querySelector(`[data-count="${k}"]`); if (el) { el.textContent = n; el.hidden = !n; } };
    badge("bookings", s.toVerify + s.toConfirm); badge("applications", s.newApplications); badge("messages", s.openMessages);
    const k = (n, label, act, alert) => `<button class="kpi${alert && n ? " alert" : ""}" type="button" data-go="${act}"><b>${n}</b><span>${label}</span></button>`;
    v.innerHTML = `<div class="kpis">
        ${k(s.toVerify, "Payments to verify", "bookings:verify", true)}${k(s.toConfirm, "Ready to confirm", "bookings:confirm", true)}${k(s.confirmed, "Upcoming sessions", "bookings:upcoming")}
        ${k(s.minorsToVerify, "Under-18 guardians to verify", "bookings:confirm", true)}${k(s.newApplications, "New mentor applications", "applications")}${k(s.openMessages, "Open messages", "messages", s.overdueGrievances > 0)}
      </div>
      <div class="grid2" style="margin-top:4px">
        <div class="card"><h3>Revenue</h3><p class="rangeval">${inr(s.revenue)}</p><p class="muted small">From ${s.paidBookings} paid or verified booking${s.paidBookings === 1 ? "" : "s"}, excluding cancellations.</p></div>
        <div class="card"><h3>Setup checklist</h3><ul class="perks">
          <li>${s.emailEnabled ? "✓" : "○"}<span>${s.emailEnabled ? "Email notifications are on." : "Email is off. Add RESEND_API_KEY in Render to send confirmations."}</span></li>
          <li>${cfg.cashfree.enabled ? "✓" : "○"}<span>${cfg.cashfree.enabled ? `Cashfree is on (${esc(cfg.cashfree.mode)}).` : "Cashfree is off. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY when your account is active."}</span></li>
          <li>${cfg.grievance.name ? "✓" : "○"}<span>${cfg.grievance.name ? "Grievance Officer is named." : "Name your Grievance Officer: set GRIEVANCE_OFFICER_NAME (required by the E-Commerce Rules)."}</span></li>
          <li>${s.overdueGrievances ? "!" : "✓"}<span>${s.overdueGrievances ? `${s.overdueGrievances} complaint${s.overdueGrievances > 1 ? "s are" : " is"} past the 48-hour acknowledgement window.` : "No complaints past the 48-hour window."}</span></li>
          <li>○<span>Database: ${esc(s.database)}. Render’s free Postgres is deleted after 30 days; move DATABASE_URL to a permanent database (for example Neon) before then.</span></li>
        </ul></div></div>`;
    v.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => { const [t, f] = b.dataset.go.split(":"); if (f) filter = f; go(t); }));
  }

  /* ---------- bookings ---------- */
  const FILTERS = [["verify", "Payments to verify"], ["confirm", "Ready to confirm"], ["upcoming", "Upcoming"], ["unpaid", "Unpaid"], ["done", "Completed or cancelled"], ["active", "All active"], ["all", "Everything"]];
  async function bookings() {
    const v = $("#view");
    v.innerHTML = `<div class="toolbar">${FILTERS.map(([k, l]) => `<button class="chip" type="button" data-f="${k}" aria-pressed="${filter === k}">${l}</button>`).join("")}<input class="input" id="bq" placeholder="Search ID, name, phone, UTR" value="${esc(query)}"></div><div class="tablewrap" id="bt"><p class="empty">Loading…</p></div>`;
    v.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.f; bookings(); }));
    let t; $("#bq").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { query = e.target.value.trim(); load(); }, 300); });
    async function load() {
      const r = await api(`/api/admin/bookings?filter=${encodeURIComponent(filter)}&q=${encodeURIComponent(query)}`);
      r.bookings.forEach((b) => { cache[b.id] = b; });
      $("#bt").innerHTML = r.bookings.length ? `<table class="atable"><thead><tr><th>ID</th><th>Created</th><th>Learner</th><th>Booking</th><th>Amount</th><th>Payment</th><th>Status</th><th>First choice</th></tr></thead><tbody>${r.bookings.map((b) => `<tr data-id="${esc(b.id)}" tabindex="0"><td class="mono">${esc(b.id)}</td><td>${ago(b.createdAt)}</td><td>${esc(b.name)}${b.isMinor ? ' <span class="status st-wait">U18</span>' : ""}<br><span class="muted small">+91 ${esc(b.phone)}</span></td><td>${esc(b.itemName)}<br><span class="muted small">${esc(b.trackName)}</span></td><td class="num">${inr(b.amount)}</td><td>${Q.pill(b.paymentStatus)}</td><td>${Q.pill(b.status)}</td><td>${esc((b.slots[0] || {}).label || "")}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">Nothing here right now.</p>`;
      $$("#bt tr[data-id]").forEach((tr) => { tr.addEventListener("click", () => openBooking(tr.dataset.id)); tr.addEventListener("keydown", (e) => { if (e.key === "Enter") openBooking(tr.dataset.id); }); });
    }
    await load();
  }

  async function openBooking(id) {
    history.replaceState(null, "", "#booking=" + id);
    const r = await api("/api/admin/bookings/" + encodeURIComponent(id));
    const b = r.booking; cache[b.id] = b;
    const link = location.origin + "/booking/" + b.id + "?t=" + encodeURIComponent(b.accessToken);
    const slotChoices = b.slots.map((s, i) => `<label><input type="radio" name="cslot" value="${esc(s.label)}"${(b.confirmedSlot || (b.slots[0] || {}).label) === s.label ? " checked" : ""}>${i === 0 ? "First choice: " : "Second: "}${esc(s.label)}</label>`).join("");
    const confirmMsg = `Hi ${b.name}, your QIVA session ${b.id} is confirmed for ${b.confirmedSlot || "[slot]"}.${b.meetingLink ? " Join here at that time: " + b.meetingLink : ""} Booking page: ${link}`;
    openDetail("Booking", b.id, `
      <div class="copyrow">${Q.pill(b.paymentStatus)}${Q.pill(b.status)}${b.isMinor ? `<span class="status ${b.guardianVerified ? "st-good" : "st-wait"}">${b.guardianVerified ? "Guardian verified" : "Guardian not verified"}</span>` : ""}</div>
      <dl class="kv"><dt>Booking</dt><dd>${esc(b.itemName)} · ${inr(b.amount)}</dd><dt>Track</dt><dd>${esc(b.trackName)}${b.focus ? " · " + esc(b.focus) : ""}</dd><dt>Topic</dt><dd>${esc(b.topic)}</dd>${b.notes ? `<dt>Notes</dt><dd>${esc(b.notes)}</dd>` : ""}
        <dt>Learner</dt><dd>${esc(b.name)} · ${esc(b.about)}</dd><dt>WhatsApp</dt><dd>+91 ${esc(b.phone)}</dd><dt>Email</dt><dd>${esc(b.email || "—")}</dd>
        ${b.isMinor ? `<dt>Guardian</dt><dd>${esc(b.guardianName)} · +91 ${esc(b.guardianPhone)}${b.guardianEmail ? " · " + esc(b.guardianEmail) : ""}<br><span class="muted small">Consent given at booking: ${b.guardianConsent ? "yes" : "no"}</span></dd>` : ""}
        <dt>Payment</dt><dd>${esc(b.paymentMethod.toUpperCase())}${b.utr ? " · UTR " + esc(b.utr) : ""}${b.cfOrderId ? " · Order " + esc(b.cfOrderId) : ""}</dd>
        <dt>Preferred</dt><dd>${b.slots.map((s) => esc(s.label)).join("<br>")}</dd><dt>Booking page</dt><dd><button class="linkbtn" type="button" data-copy="${esc(link)}">Copy link to share with the learner</button></dd></dl>
      ${b.paymentStatus === "submitted" ? `<div class="guardian"><span class="hd">Verify the UPI payment</span><span class="small">Find ${inr(b.amount)} with UTR <span class="mono">${esc(b.utr)}</span> in your bank or UPI app, then mark it verified.</span><div class="copyrow"><button class="btn btn-dark btn-sm" type="button" data-pay="verified">Payment verified</button><button class="btn btn-sm" type="button" data-pay="failed">Not received</button></div></div>` : ""}
      <p class="sectionlbl">Confirm the session</p>
      <div class="field"><span class="lbl">Slot</span><div class="radios" id="cSlots">${slotChoices}<label><input type="radio" name="cslot" value="__custom">Other</label></div><input class="input" id="cCustom" placeholder="For example: Sun 26 Oct, 11:00 AM IST" value="${b.slots.some((s) => s.label === b.confirmedSlot) ? "" : esc(b.confirmedSlot)}"></div>
      <div class="field"><label for="cLink">Meeting link</label><input class="input" id="cLink" type="url" placeholder="Leave empty to create a private Jitsi room, or paste a Google Meet link" value="${esc(b.meetingLink)}"><span class="hint">meet.jit.si asks the host to sign in with Google, GitHub or Facebook before guests can join.</span></div>
      ${b.isMinor ? `<label class="check"><input type="checkbox" id="cGuard"${b.guardianVerified ? " checked" : ""}><span>I spoke to the parent or guardian on +91 ${esc(b.guardianPhone)} and confirmed their consent.</span></label>` : ""}
      <div class="field"><label for="cNotes">Internal notes</label><textarea class="input" id="cNotes">${esc(b.adminNotes)}</textarea></div>
      <span class="err" id="cErr" role="alert"></span>
      <div class="copyrow"><button class="btn btn-dark" type="button" id="cConfirm">${b.status === "confirmed" ? "Save changes" : "Confirm session"}</button><button class="btn" type="button" id="cSave">Save notes</button>
        <a class="btn" href="${esc(Q.wa({ whatsapp: "91" + b.phone }, confirmMsg))}" target="_blank" rel="noopener">WhatsApp the learner</a></div>
      <div class="copyrow">${b.status === "confirmed" ? '<button class="btn btn-sm" type="button" data-st="completed">Mark completed</button>' : ""}${b.status !== "cancelled" ? '<button class="btn btn-sm" type="button" data-st="cancelled">Cancel booking</button>' : ""}${["verified", "paid"].includes(b.paymentStatus) ? '<button class="btn btn-sm" type="button" data-pay="refunded">Mark refunded</button>' : ""}</div>
      <p class="sectionlbl">Activity</p><div class="log">${r.log.map((l) => `<span>${esc(Q.dateIN(l.created_at))} · ${esc(l.action.replace(/_/g, " "))}</span>`).join("") || "<span>No activity yet.</span>"}</div>`);
    const patch = async (body) => {
      try { await api("/api/admin/bookings/" + encodeURIComponent(b.id), { method: "PATCH", body }); Q.toast("Saved"); await openBooking(b.id); if (tab === "bookings") bookings(); }
      catch (x) { $("#cErr").textContent = x.message; }
    };
    const slotVal = () => { const s = document.querySelector('input[name="cslot"]:checked'); return !s ? "" : s.value === "__custom" ? $("#cCustom").value.trim() : s.value; };
    $("#dBody").querySelectorAll("[data-pay]").forEach((x) => x.addEventListener("click", () => patch({ paymentStatus: x.dataset.pay })));
    $("#dBody").querySelectorAll("[data-st]").forEach((x) => x.addEventListener("click", () => {
      if (x.dataset.st === "cancelled" && x.dataset.sure !== "1") { x.dataset.sure = "1"; x.textContent = "Tap again to cancel"; return; }
      patch({ status: x.dataset.st, adminNotes: $("#cNotes").value });
    }));
    $("#cConfirm").addEventListener("click", () => patch({ status: "confirmed", confirmedSlot: slotVal(), meetingLink: $("#cLink").value.trim(), guardianVerified: $("#cGuard") ? $("#cGuard").checked : undefined, adminNotes: $("#cNotes").value }));
    $("#cSave").addEventListener("click", () => patch({ adminNotes: $("#cNotes").value, guardianVerified: $("#cGuard") ? $("#cGuard").checked : undefined }));
  }

  /* ---------- applications ---------- */
  async function applications() {
    const v = $("#view"); v.innerHTML = `<div class="tablewrap" id="at"><p class="empty">Loading…</p></div>`;
    const r = await api("/api/admin/applications");
    r.applications.forEach((a) => { cache[a.id] = a; });
    $("#at").innerHTML = r.applications.length ? `<table class="atable"><thead><tr><th>Ref</th><th>Received</th><th>Name</th><th>Role</th><th>Years</th><th>Tracks</th><th>Hours / month</th><th>Status</th></tr></thead><tbody>${r.applications.map((a) => `<tr data-id="${esc(a.id)}" tabindex="0"><td class="mono">${esc(a.id)}</td><td>${ago(a.created_at)}</td><td>${esc(a.name)}<br><span class="muted small">${esc(a.city)}</span></td><td>${esc(a.job_role)}</td><td class="num">${a.experience_years}</td><td>${esc(a.trackNames.join(", "))}</td><td class="num">${a.hours_per_month}</td><td>${Q.pill(a.status)}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">No applications yet. Share qiva’s /mentor page to invite mentors.</p>`;
    $$("#at tr[data-id]").forEach((tr) => tr.addEventListener("click", () => openApp(tr.dataset.id)));
  }
  function openApp(id) {
    const a = cache[id];
    openDetail("Mentor application", a.name, `<div class="copyrow">${Q.pill(a.status)}<span class="mono">${esc(a.id)}</span></div>
      <dl class="kv"><dt>Role</dt><dd>${esc(a.job_role)} · ${a.experience_years} years</dd><dt>City</dt><dd>${esc(a.city)}</dd><dt>Tracks</dt><dd>${esc(a.trackNames.join(", "))}</dd><dt>Hours</dt><dd>${a.hours_per_month} a month</dd><dt>Languages</dt><dd>${esc(a.languages || "—")}</dd>
        <dt>Email</dt><dd>${esc(a.email)}</dd><dt>Phone</dt><dd>+91 ${esc(a.phone)}</dd>${a.linkedin ? `<dt>Link</dt><dd><a href="${esc(a.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(a.linkedin)}</a></dd>` : ""}<dt>Why</dt><dd style="white-space:pre-wrap">${esc(a.why)}</dd></dl>
      <div class="field"><label for="apSt">Status</label><select class="input" id="apSt">${["new", "shortlisted", "interview", "onboarded", "rejected"].map((s) => `<option value="${s}"${a.status === s ? " selected" : ""}>${s[0].toUpperCase() + s.slice(1)}</option>`).join("")}</select></div>
      <div class="field"><label for="apNotes">Notes</label><textarea class="input" id="apNotes">${esc(a.admin_notes)}</textarea></div><span class="err" id="apErr"></span>
      <div class="copyrow"><button class="btn btn-dark" type="button" id="apSave">Save</button><a class="btn" href="${esc(Q.wa({ whatsapp: "91" + a.phone }, `Hi ${a.name}, thank you for applying to mentor with QIVA (${a.id}). Could we set up a short intro call this week?`))}" target="_blank" rel="noopener">WhatsApp</a></div>`);
    $("#apSave").addEventListener("click", async () => {
      try { await api("/api/admin/applications/" + encodeURIComponent(a.id), { method: "PATCH", body: { status: $("#apSt").value, adminNotes: $("#apNotes").value } }); Q.toast("Saved"); closeDetail(); applications(); }
      catch (x) { $("#apErr").textContent = x.message; }
    });
  }

  /* ---------- messages ---------- */
  async function messages() {
    const v = $("#view"); v.innerHTML = `<div class="tablewrap" id="mt"><p class="empty">Loading…</p></div>`;
    const r = await api("/api/admin/messages");
    r.messages.forEach((m) => { cache[m.id] = m; });
    const kindLbl = { enquiry: "Question", grievance: "Complaint", data_request: "Data request" };
    $("#mt").innerHTML = r.messages.length ? `<table class="atable"><thead><tr><th>Ticket</th><th>Received</th><th>Type</th><th>From</th><th>Subject</th><th>Status</th></tr></thead><tbody>${r.messages.map((m) => {
      const late = m.kind === "grievance" && !m.acknowledged_at && Date.now() - Date.parse(m.created_at) > 48 * 3600e3;
      return `<tr data-id="${esc(m.id)}" tabindex="0"><td class="mono">${esc(m.id)}</td><td>${ago(m.created_at)}${late ? ' <span class="status st-bad">Past 48 h</span>' : ""}</td><td>${kindLbl[m.kind]}</td><td>${esc(m.name)}<br><span class="muted small">${esc(m.email || (m.phone ? "+91 " + m.phone : ""))}</span></td><td>${esc(m.subject || m.body.slice(0, 60))}</td><td>${Q.pill(m.status)}</td></tr>`;
    }).join("")}</tbody></table>` : `<p class="empty">No messages yet.</p>`;
    $$("#mt tr[data-id]").forEach((tr) => tr.addEventListener("click", () => openMsg(tr.dataset.id)));
  }
  function openMsg(id) {
    const m = cache[id];
    openDetail(m.kind === "grievance" ? "Complaint" : m.kind === "data_request" ? "Data request" : "Question", m.id, `<div class="copyrow">${Q.pill(m.status)}<span class="muted small">Received ${esc(Q.dateIN(m.created_at))}</span></div>
      <dl class="kv"><dt>From</dt><dd>${esc(m.name)}</dd><dt>Email</dt><dd>${esc(m.email || "—")}</dd><dt>Phone</dt><dd>${m.phone ? "+91 " + esc(m.phone) : "—"}</dd>${m.booking_id ? `<dt>Booking</dt><dd class="mono">${esc(m.booking_id)}</dd>` : ""}<dt>Subject</dt><dd>${esc(m.subject || "—")}</dd><dt>Message</dt><dd style="white-space:pre-wrap">${esc(m.body)}</dd></dl>
      ${m.kind === "grievance" ? '<p class="note small">Acknowledge within 48 hours and resolve within one month (Consumer Protection E-Commerce Rules, 2020).</p>' : m.kind === "data_request" ? '<p class="note small">Reply within 90 days (DPDP Rules). For deletion, keep records the law requires, such as invoices.</p>' : ""}
      <div class="field"><label for="msNotes">Notes</label><textarea class="input" id="msNotes">${esc(m.admin_notes)}</textarea></div><span class="err" id="msErr"></span>
      <div class="copyrow"><button class="btn btn-dark" type="button" data-ms="acknowledged">Mark acknowledged</button><button class="btn" type="button" data-ms="resolved">Mark resolved</button>${m.phone ? `<a class="btn" href="${esc(Q.wa({ whatsapp: "91" + m.phone }, `Hi ${m.name}, this is QIVA about your ticket ${m.id}.`))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</div>
      ${m.email ? `<p class="muted small">Reply by email to <span class="mono">${esc(m.email)}</span> <button class="linkbtn" type="button" data-copy="${esc(m.email)}">Copy</button></p>` : ""}`);
    $("#dBody").querySelectorAll("[data-ms]").forEach((b) => b.addEventListener("click", async () => {
      try { await api("/api/admin/messages/" + encodeURIComponent(m.id), { method: "PATCH", body: { status: b.dataset.ms, adminNotes: $("#msNotes").value } }); Q.toast("Saved"); closeDetail(); messages(); }
      catch (x) { $("#msErr").textContent = x.message; }
    }));
  }

  /* ---------- people ---------- */
  async function people() {
    const v = $("#view"); v.innerHTML = `<div class="tablewrap" id="pt"><p class="empty">Loading…</p></div>`;
    const r = await api("/api/admin/users");
    $("#pt").innerHTML = r.users.length ? `<table class="atable"><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Role</th><th>Under 18</th><th>Joined</th><th>Last sign-in</th></tr></thead><tbody>${r.users.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.phone ? "+91 " + esc(u.phone) : "—"}</td><td>${esc(u.role)}</td><td>${u.is_minor ? "Yes · " + esc(u.guardian_name) : "No"}</td><td>${esc(Q.dateIN(u.created_at))}</td><td>${u.last_login_at ? ago(u.last_login_at) : "—"}</td></tr>`).join("")}</tbody></table>` : `<p class="empty">No accounts yet.</p>`;
  }

  document.addEventListener("DOMContentLoaded", async () => {
    root = $("#adminRoot");
    cfg = await Q.config();
    if (!cfg.user || cfg.user.role !== "admin") return gate();
    shell();
    const h = location.hash.slice(1);
    if (h.startsWith("booking=")) { go("bookings", true); openBooking(h.split("=")[1]); }
    else go(TABS.some(([k]) => k === h) ? h : "overview", true);
    if (C) { /* catalog available for future filters */ }
  });
})();
