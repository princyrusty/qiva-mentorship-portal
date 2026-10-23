"use strict";
// End-to-end tests against the real Express app and an in-memory Postgres (PGlite).
// Run with: npm test
process.env.NODE_ENV = "test";
process.env.ADMIN_SETUP_CODE = "test-setup-code-123";
delete process.env.DATABASE_URL;
delete process.env.RESEND_API_KEY;
delete process.env.CASHFREE_APP_ID;
delete process.env.CASHFREE_SECRET_KEY;

const test = require("node:test");
const assert = require("node:assert/strict");
const cfg = require("../src/config");
const db = require("../src/db");
const C = require("../public/catalog");
const { createApp } = require("../server");

let server, base;

function client() {
  const jar = new Map();
  async function call(method, path, body, headers) {
    const h = { Accept: "application/json", ...(headers || {}) };
    if (jar.size) h.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    let payload;
    if (body !== undefined) { h["Content-Type"] = h["Content-Type"] || "application/json"; payload = typeof body === "string" ? body : JSON.stringify(body); }
    const r = await fetch(base + path, { method, headers: h, body: payload, redirect: "manual" });
    for (const c of r.headers.getSetCookie()) {
      const [pair] = c.split(";"); const i = pair.indexOf("=");
      const k = pair.slice(0, i), v = pair.slice(i + 1);
      if (!v || /Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(c)) jar.delete(k); else jar.set(k, v);
    }
    const type = r.headers.get("content-type") || "";
    const data = type.includes("json") ? await r.json() : await r.text();
    return { status: r.status, data, headers: r.headers };
  }
  return {
    jar,
    get: (p, h) => call("GET", p, undefined, h),
    post: (p, b, h) => call("POST", p, b === undefined ? {} : b, h),
    patch: (p, b) => call("PATCH", p, b)
  };
}

// Two valid slots inside the booking window, computed the same way the server does.
function slots(n) {
  const out = [];
  for (const d of C.upcomingDays(8)) {
    for (const t of C.slotTimes(d.weekend)) { out.push({ date: d.key, time: t }); if (out.length === n) return out; }
  }
  return out;
}

const booking = (over) => ({
  itemId: "pragati", track: "career", focus: "Choosing a stream", about: C.ABOUT[1],
  topic: "Science or commerce after Class 10", notes: "", slots: slots(2),
  name: "Riya Sharma", phone: "+91 98765 43210", email: "riya@example.com",
  isMinor: false, acceptTerms: true, ...(over || {})
});

test.before(async () => {
  await db.init(cfg);
  const app = createApp();
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = "http://127.0.0.1:" + server.address().port;
});
test.after(async () => { await new Promise((r) => server.close(r)); await db.end(); });

test("public pages, SEO files and assets load", async () => {
  const c = client();
  for (const p of ["/", "/mentor", "/contact", "/terms", "/privacy", "/refund-policy", "/service-delivery", "/account", "/reset-password", "/admin", "/booking/QV-ABCDEF"]) {
    const r = await c.get(p);
    assert.equal(r.status, 200, p);
    assert.match(r.data, /<title>[^<]+<\/title>/, p);
    assert.match(r.data, /\/catalog\.js/, p);
  }
  const home = await c.get("/");
  assert.match(home.data, /application\/ld\+json/);
  assert.match(home.data, /FAQPage/);
  assert.ok(home.headers.get("content-security-policy"), "CSP header set");
  assert.equal((await c.get("/nope")).status, 404);
  assert.match((await c.get("/robots.txt")).data, /Disallow: \/admin/);
  assert.match((await c.get("/sitemap.xml")).data, /<loc>[^<]+\/mentor<\/loc>/);
  assert.equal((await c.get("/healthz")).data.ok, true);
  for (const p of ["/site.css", "/common.js", "/catalog.js", "/booking-flow.js", "/home.js", "/admin.js", "/account.js", "/booking.js", "/mentor.js", "/contact.js", "/faq.json", "/favicon.svg", "/og-image.png", "/site.webmanifest"]) {
    assert.equal((await c.get(p)).status, 200, p);
  }
  assert.equal((await c.get("/grievance")).status, 301);
});

test("API rejects cross-site and non-JSON writes", async () => {
  const c = client();
  const evil = await c.post("/api/messages", { kind: "enquiry" }, { Origin: "https://evil.example" });
  assert.equal(evil.status, 403);
  const plain = await c.post("/api/messages", "name=x", { "Content-Type": "text/plain" });
  assert.equal(plain.status, 415);
  const cfgRes = await c.get("/api/config");
  assert.equal(cfgRes.data.upiId, "9084687772@ptsbi");
  assert.equal(cfgRes.data.cashfree.enabled, false);
  assert.equal(cfgRes.data.user, null);
});

let guestBooking;
test("guest booking: validation, UPI reference, duplicate UTR", async () => {
  const c = client();
  assert.equal((await c.post("/api/bookings", booking({ acceptTerms: false }))).status, 400);
  assert.equal((await c.post("/api/bookings", booking({ phone: "12345" }))).status, 400);
  assert.equal((await c.post("/api/bookings", booking({ itemId: "free" }))).status, 400);
  const bad = await c.post("/api/bookings", booking({ slots: [{ date: "2020-01-01", time: "5:00 PM" }] }));
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /no longer available/);
  assert.equal((await c.post("/api/bookings", booking({ amount: 1 }))).status, 201, "unknown fields are ignored");

  const r = await c.post("/api/bookings", booking());
  assert.equal(r.status, 201);
  assert.match(r.data.id, /^QV-[A-Z2-9]{6}$/);
  assert.equal(r.data.amount, C.item("pragati").price, "price comes from the server catalog");
  assert.match(r.data.upi.link, /^upi:\/\/pay\?pa=9084687772%40ptsbi/);
  guestBooking = r.data;

  assert.equal((await c.get(`/api/bookings/${r.data.id}?t=wrong`)).status, 404);
  const s = await c.get(`/api/bookings/${r.data.id}?t=${encodeURIComponent(r.data.token)}`);
  assert.equal(s.data.booking.paymentStatus, "pending");
  assert.equal(s.data.booking.meetingLink, "");

  assert.equal((await c.post(`/api/bookings/${r.data.id}/utr`, { token: r.data.token, utr: "12345" })).status, 400);
  assert.equal((await c.post(`/api/bookings/${r.data.id}/utr`, { token: "nope", utr: "123456789012" })).status, 404);
  const u = await c.post(`/api/bookings/${r.data.id}/utr`, { token: r.data.token, utr: "123456789012" });
  assert.equal(u.status, 200);
  assert.equal(u.data.booking.paymentStatus, "submitted");
  assert.equal(u.data.booking.utrLast4, "9012");
  assert.equal((await c.post(`/api/bookings/${r.data.id}/utr`, { token: r.data.token, utr: "123456789013" })).status, 409, "cannot resubmit");

  const other = await c.post("/api/bookings", booking({ itemId: "s30", slots: slots(1) }));
  const dup = await c.post(`/api/bookings/${other.data.id}/utr`, { token: other.data.token, utr: "123456789012" });
  assert.equal(dup.status, 409);

  assert.equal((await c.post(`/api/bookings/${r.data.id}/cashfree`, { token: r.data.token })).status, 400, "Cashfree off without keys");
  assert.equal((await c.post("/api/webhooks/cashfree", { type: "PAYMENT_SUCCESS_WEBHOOK" })).status, 400, "unsigned webhook refused");
});

let minorBooking;
test("under-18 booking needs a guardian and consent", async () => {
  const c = client();
  const no = await c.post("/api/bookings", booking({ isMinor: true }));
  assert.equal(no.status, 400);
  assert.match(no.data.error, /parent or guardian/i);
  const noConsent = await c.post("/api/bookings", booking({ isMinor: true, guardianName: "Anil Sharma", guardianPhone: "9876500000" }));
  assert.equal(noConsent.status, 400);
  const ok = await c.post("/api/bookings", booking({ isMinor: true, guardianName: "Anil Sharma", guardianPhone: "9876500000", guardianConsent: true, itemId: "s60", slots: slots(1) }));
  assert.equal(ok.status, 201);
  minorBooking = ok.data;
  await c.post(`/api/bookings/${ok.data.id}/utr`, { token: ok.data.token, utr: "555566667777" });
});

test("student accounts: signup, session, my bookings, data request, reset", async () => {
  const c = client();
  assert.equal((await c.post("/api/auth/signup", { name: "Kabir", email: "kabir@example.com", phone: "9811122233", password: "short", acceptTerms: true })).status, 400);
  const s = await c.post("/api/auth/signup", { name: "Kabir Mehta", email: "Kabir@Example.com", phone: "9811122233", password: "goodpassword1", acceptTerms: true });
  assert.equal(s.status, 201);
  const cookie = s.headers.getSetCookie().join(";");
  assert.match(cookie, /qiva_sid=/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  const me = await c.get("/api/auth/me");
  assert.equal(me.data.user.email, "kabir@example.com");
  assert.equal(me.data.user.role, "student");
  assert.equal((await c.post("/api/auth/signup", { name: "Kabir Two", email: "kabir@example.com", phone: "9811122233", password: "goodpassword1", acceptTerms: true })).status, 409);

  const b = await c.post("/api/bookings", booking({ name: "Kabir Mehta", phone: "9811122233", email: "kabir@example.com", itemId: "s90", slots: slots(1) }));
  assert.equal(b.status, 201);
  const mine = await c.get("/api/me/bookings");
  assert.equal(mine.data.bookings.length, 1);
  assert.equal(mine.data.bookings[0].id, b.data.id);

  const dr = await c.post("/api/me/data-request", { type: "access", details: "Please send my data." });
  assert.equal(dr.status, 201);
  assert.match(dr.data.id, /^QT-/);
  assert.equal((await c.get("/api/admin/summary")).status, 403, "students cannot use admin API");

  await c.post("/api/auth/logout");
  assert.equal((await c.get("/api/auth/me")).data.user, null);
  assert.equal((await c.get("/api/me/bookings")).status, 401);
  assert.equal((await c.post("/api/auth/login", { email: "kabir@example.com", password: "wrongpassword" })).status, 401);
  assert.equal((await c.post("/api/auth/login", { email: "KABIR@example.com", password: "goodpassword1" })).status, 200);
  const f = await c.post("/api/auth/forgot", { email: "kabir@example.com" });
  assert.equal(f.status, 200);
  assert.equal(f.data.emailEnabled, false);
  assert.equal((await c.post("/api/auth/reset", { token: "x".repeat(20), password: "anotherpass1" })).status, 400);
});

test("mentor applications and contact tickets", async () => {
  const c = client();
  const app = { name: "Neha Joshi", email: "neha@example.com", phone: "9822233344", city: "Pune", tracks: ["career", "ai"], jobRole: "Product manager", experienceYears: "7", hoursPerMonth: "6", languages: "English, Hindi", linkedin: "", why: "I want to help students avoid the mistakes I made early in my career.", consent: true };
  assert.equal((await c.post("/api/mentor-applications", { ...app, tracks: [] })).status, 400);
  assert.equal((await c.post("/api/mentor-applications", { ...app, linkedin: "javascript:alert(1)" })).status, 400);
  const a = await c.post("/api/mentor-applications", app);
  assert.equal(a.status, 201);
  assert.match(a.data.id, /^MA-/);

  assert.equal((await c.post("/api/messages", { kind: "enquiry", name: "Om", body: "Hello there, a question." })).status, 400, "needs a way to reply");
  const g = await c.post("/api/messages", { kind: "grievance", name: "Om Prakash", phone: "9833344455", body: "My session link did not arrive on time.", bookingId: guestBooking.id.toLowerCase() });
  assert.equal(g.status, 201);
  assert.match(g.data.id, /^QT-/);
});

test("admin: first-run setup, verify, confirm, applications, messages, exports", async () => {
  const c = client();
  assert.equal((await c.get("/api/admin/summary")).status, 401);
  assert.equal((await c.get("/api/admin/setup-status")).data.needsSetup, true);
  assert.equal((await c.post("/api/admin/setup", { code: "wrong", name: "Owner", email: "owner@example.com", password: "ownerpassword1" })).status, 403);
  assert.equal((await c.post("/api/admin/setup", { code: "test-setup-code-123", name: "Owner", email: "owner@example.com", password: "short" })).status, 400);
  const s = await c.post("/api/admin/setup", { code: "test-setup-code-123", name: "Owner", email: "owner@example.com", password: "ownerpassword1" });
  assert.equal(s.status, 201);
  assert.equal((await client().post("/api/admin/setup", { code: "test-setup-code-123", name: "Other", email: "x@example.com", password: "ownerpassword1" })).status, 409, "setup runs once");
  assert.equal((await c.get("/api/config")).data.user.role, "admin");

  const sum = await c.get("/api/admin/summary");
  assert.equal(sum.status, 200);
  assert.equal(sum.data.toVerify, 2);
  assert.equal(sum.data.newApplications, 1);
  assert.equal(sum.data.database, "pglite");

  const list = await c.get("/api/admin/bookings?filter=verify");
  assert.equal(list.data.bookings.length, 2);
  const found = await c.get("/api/admin/bookings?filter=all&q=" + guestBooking.id.slice(3).toLowerCase());
  assert.equal(found.data.bookings[0].id, guestBooking.id);

  const id = guestBooking.id;
  const early = await c.patch("/api/admin/bookings/" + id, { status: "confirmed", confirmedSlot: "x" });
  assert.equal(early.status, 400);
  assert.match(early.data.error, /Verify the payment/);
  assert.equal((await c.patch("/api/admin/bookings/" + id, { paymentStatus: "verified" })).status, 200);
  assert.equal((await c.patch("/api/admin/bookings/" + id, { meetingLink: "not a link" })).status, 400);
  const d = await c.get("/api/admin/bookings/" + id);
  const conf = await c.patch("/api/admin/bookings/" + id, { status: "confirmed", confirmedSlot: d.data.booking.slots[0].label });
  assert.equal(conf.status, 200);
  assert.match(conf.data.booking.meetingLink, /^https:\/\/meet\.jit\.si\/QIVA-/);
  const pub = await client().get(`/api/bookings/${id}?t=${encodeURIComponent(guestBooking.token)}`);
  assert.equal(pub.data.booking.status, "confirmed");
  assert.equal(pub.data.booking.meetingLink, conf.data.booking.meetingLink, "learner sees the room once confirmed");
  const log = await c.get("/api/admin/bookings/" + id);
  assert.ok(log.data.log.some((l) => l.action === "booking_updated"));

  const mid = minorBooking.id;
  await c.patch("/api/admin/bookings/" + mid, { paymentStatus: "verified" });
  const mNo = await c.patch("/api/admin/bookings/" + mid, { status: "confirmed", confirmedSlot: "Sun 26 Oct, 11:00 AM IST" });
  assert.equal(mNo.status, 400);
  assert.match(mNo.data.error, /under 18/);
  const mOk = await c.patch("/api/admin/bookings/" + mid, { status: "confirmed", confirmedSlot: "Sun 26 Oct, 11:00 AM IST", guardianVerified: true, meetingLink: "https://meet.google.com/abc-defg-hij" });
  assert.equal(mOk.status, 200);
  assert.equal(mOk.data.booking.meetingLink, "https://meet.google.com/abc-defg-hij");

  const apps = await c.get("/api/admin/applications");
  assert.deepEqual(apps.data.applications[0].trackNames.length, 2);
  const ap = await c.patch("/api/admin/applications/" + apps.data.applications[0].id, { status: "shortlisted", adminNotes: "Strong product background" });
  assert.equal(ap.data.application.status, "shortlisted");

  const msgs = await c.get("/api/admin/messages");
  const g = msgs.data.messages.find((m) => m.kind === "grievance");
  assert.ok(g);
  assert.equal(g.booking_id, guestBooking.id);
  const ack = await c.patch("/api/admin/messages/" + g.id, { status: "acknowledged" });
  assert.ok(ack.data.message.acknowledged_at);
  assert.equal(ack.data.message.resolved_at, null);
  assert.ok(msgs.data.messages.some((m) => m.kind === "data_request"));

  const users = await c.get("/api/admin/users");
  assert.ok(users.data.users.length >= 2);
  assert.ok(!("password_hash" in users.data.users[0]), "no password hashes in admin API");

  const csv = await c.get("/api/admin/export/bookings");
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type"), /text\/csv/);
  assert.ok(csv.data.startsWith('"id","created_at","name"'), "CSV header");
  assert.match(csv.data, /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "dates exported as ISO 8601");
  const raw = Buffer.from(await (await fetch(base + "/api/admin/export/bookings", { headers: { Cookie: [...c.jar].map(([k, v]) => `${k}=${v}`).join("; ") } })).arrayBuffer());
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], "UTF-8 BOM so Excel shows ₹ and Hindi correctly");
  assert.equal((await c.get("/api/admin/export/sessions")).status, 404);

  const final = await c.get("/api/admin/summary");
  assert.equal(final.data.confirmed, 2);
  assert.equal(final.data.revenue, C.item("pragati").price + C.item("s60").price);
});

test("CSV export neutralises spreadsheet formulas", async () => {
  const U = require("../src/util");
  const out = U.toCsv([{ a: "=HYPERLINK(\"x\")", b: "plain, text", c: "+91 98" }]);
  assert.match(out, /'=HYPERLINK/);
  assert.match(out, /"plain, text"/);
});
