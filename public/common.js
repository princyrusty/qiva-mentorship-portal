/* Shared browser helpers for every QIVA page. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  async function api(path, opts) {
    const o = opts || {};
    const init = { method: o.method || "GET", credentials: "same-origin", headers: { Accept: "application/json" } };
    if (o.body !== undefined) { init.headers["Content-Type"] = "application/json"; init.body = JSON.stringify(o.body); }
    let r;
    try { r = await fetch(path, init); } catch (e) { throw new Error("You seem to be offline. Check your connection and try again."); }
    let data = {};
    try { data = await r.json(); } catch (e) { /* empty body */ }
    if (!r.ok) {
      const err = new Error(data.error || (r.status >= 500 ? "Something went wrong on our side. Please try again." : "That did not work. Please try again."));
      err.status = r.status;
      throw err;
    }
    return data;
  }

  let cfgPromise = null;
  const config = () => (cfgPromise = cfgPromise || api("/api/config").catch(() => ({ user: null, whatsapp: "919997030409", whatsappDisplay: "+91 99970 30409", upiId: "9084687772@ptsbi", cashfree: { enabled: false } })));
  const wa = (cfg, text) => "https://wa.me/" + (cfg.whatsapp || "919997030409") + "?text=" + encodeURIComponent(text);

  let toastT;
  function toast(msg) {
    const t = $("#toast"); if (!t) return;
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function copy(text) {
    const done = () => toast("Copied");
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { toast("Select and copy: " + text); }
      ta.remove();
    };
    try { navigator.clipboard.writeText(text).then(done, fallback); } catch (e) { fallback(); }
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-copy]"); if (b) copy(b.dataset.copy); });

  // Bookings made on this device (guest or signed in), so people can reopen their booking pages.
  const local = {
    get() { try { return JSON.parse(localStorage.getItem("qiva.bookings") || "[]"); } catch (e) { return []; } },
    add(b) { try { const all = local.get().filter((x) => x.id !== b.id); all.unshift(b); localStorage.setItem("qiva.bookings", JSON.stringify(all.slice(0, 30))); } catch (e) { /* storage blocked */ } },
    remove(id) { try { localStorage.setItem("qiva.bookings", JSON.stringify(local.get().filter((x) => x.id !== id))); } catch (e) { /* storage blocked */ } }
  };

  const STATUS = {
    pending: ["Awaiting payment", "st-wait"], submitted: ["Payment being verified", "st-info"], verified: ["Payment verified", "st-good"],
    paid: ["Paid online", "st-good"], failed: ["Payment failed", "st-bad"], refunded: ["Refunded", "st-mute"],
    requested: ["Awaiting confirmation", "st-wait"], confirmed: ["Confirmed", "st-good"], completed: ["Completed", "st-mute"], cancelled: ["Cancelled", "st-bad"],
    new: ["New", "st-info"], shortlisted: ["Shortlisted", "st-info"], interview: ["Intro call", "st-wait"], onboarded: ["Onboarded", "st-good"], rejected: ["Not a fit", "st-mute"],
    open: ["Open", "st-wait"], acknowledged: ["Acknowledged", "st-info"], resolved: ["Resolved", "st-good"]
  };
  const pill = (s) => { const v = STATUS[s] || [s, "st-mute"]; return `<span class="status ${v[1]}">${esc(v[0])}</span>`; };
  function bookingState(b) {
    if (b.status === "cancelled") return pill("cancelled");
    if (b.status === "completed") return pill("completed");
    if (b.status === "confirmed") return pill("confirmed");
    if (b.paymentStatus === "pending" || b.paymentStatus === "failed") return pill(b.paymentStatus);
    if (b.paymentStatus === "submitted") return pill("submitted");
    return pill("requested");
  }
  const dateIN = (d) => new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

  // Header: signed-in state, mobile menu, booking links on pages other than home.
  document.addEventListener("DOMContentLoaded", () => {
    config().then((c) => {
      if (c.user) {
        const l = $("#accountLabel"); if (l) l.textContent = c.user.role === "admin" ? "Admin" : "My account";
        const a = $("#accountLink"); if (a && c.user.role === "admin") a.href = "/admin";
      }
    });
    const sheet = $("#sheet"), mb = $("#menuBtn");
    if (sheet && mb) {
      const close = () => { sheet.hidden = true; mb.setAttribute("aria-expanded", "false"); mb.focus(); };
      mb.addEventListener("click", () => { sheet.hidden = false; mb.setAttribute("aria-expanded", "true"); $("#sheetClose").focus(); });
      $("#sheetClose").addEventListener("click", close);
      sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("a")) sheet.hidden = true; });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sheet.hidden) close(); });
    }
  });

  window.QIVA = { $, $$, esc, inr, api, config, wa, toast, copy, local, pill, bookingState, dateIN, reduce };
})();
