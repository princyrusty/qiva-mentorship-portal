"use strict";
// Public JSON API: site config, student accounts, bookings and payments, mentor applications, messages and tickets.
const express = require("express");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");
const cfg = require("./config");
const db = require("./db");
const C = require("../public/catalog");
const U = require("./util");
const auth = require("./auth");
const mail = require("./email");
const cf = require("./cashfree");

const router = express.Router();

const limit = (max, minutes) => rateLimit({
  windowMs: minutes * 60e3, limit: max, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Too many attempts. Please wait a few minutes and try again." }
});
const fail = (res, msg, code = 400) => res.status(code).json({ error: msg });
function parse(schema, body, res) {
  const r = schema.safeParse(body || {});
  if (!r.success) { fail(res, (r.error.issues[0] && r.error.issues[0].message) || "Please check the form and try again."); return null; }
  return r.data;
}
const text = (min, max, label) => z.string({ required_error: `${label} is required.`, invalid_type_error: `${label} is required.` })
  .trim().min(min, min > 1 ? `${label} needs at least ${min} characters.` : `${label} is required.`).max(max, `${label} is too long.`);
const optText = (max) => z.string().trim().max(max).optional().default("");
const phone = (label) => z.string({ required_error: `${label} is required.` }).transform((v, ctx) => {
  const p = U.normalizePhone(v);
  if (!p) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter a valid 10-digit Indian mobile number for ${label.toLowerCase()}.` });
  return p;
});
const email = z.string().trim().toLowerCase().max(160).email("Enter a valid email address.");
const optEmail = z.union([z.literal(""), email]).optional().default("");

async function audit(actorId, action, entity, entityId, details) {
  try { await db.query("INSERT INTO audit_log (actor_id, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5)", [actorId || null, action, entity, String(entityId), details ? JSON.stringify(details) : null]); }
  catch (e) { console.error("[audit]", e.message); }
}
async function uniqueId(prefix, n, table) {
  for (let i = 0; i < 6; i++) {
    const id = prefix + U.rid(n);
    const hit = await db.one(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
    if (!hit) return id;
  }
  throw new Error("Could not allocate an id");
}

/* ---------- site config ---------- */
router.get("/config", (req, res) => {
  res.json({
    upiId: cfg.upiId, upiPayee: cfg.upiPayee, whatsapp: cfg.whatsapp, whatsappDisplay: cfg.whatsappDisplay,
    supportPhone: cfg.supportPhone, supportEmail: cfg.supportEmail, supportHours: cfg.supportHours,
    company: cfg.company, grievance: cfg.grievance,
    cashfree: { enabled: cf.enabled(), mode: cf.mode() }, emailEnabled: mail.configured(),
    user: req.user ? publicUser(req.user) : null
  });
});
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, isMinor: u.is_minor, guardianName: u.guardian_name, guardianPhone: u.guardian_phone, guardianEmail: u.guardian_email });

/* ---------- accounts ---------- */
const signupSchema = z.object({
  name: text(2, 80, "Name"), email, phone: phone("Phone"),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
  isMinor: z.boolean().default(false),
  guardianName: optText(80), guardianPhone: z.string().optional().default(""), guardianEmail: optEmail, guardianConsent: z.boolean().default(false),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please accept the Terms and Privacy Policy." }) })
}).superRefine((d, ctx) => {
  if (!d.isMinor) return;
  if (d.guardianName.length < 2) ctx.addIssue({ code: "custom", message: "Add your parent or guardian’s name." });
  if (!U.normalizePhone(d.guardianPhone)) ctx.addIssue({ code: "custom", message: "Add your parent or guardian’s 10-digit mobile number." });
  if (!d.guardianConsent) ctx.addIssue({ code: "custom", message: "Your parent or guardian must give consent for learners under 18." });
});

router.post("/auth/signup", limit(10, 60), async (req, res) => {
  const d = parse(signupSchema, req.body, res); if (!d) return;
  if (await db.one("SELECT 1 FROM users WHERE lower(email) = $1", [d.email])) return fail(res, "An account with this email already exists. Sign in instead.", 409);
  const hash = await auth.hashPassword(d.password);
  const u = await db.one(
    `INSERT INTO users (email, name, phone, password_hash, is_minor, guardian_name, guardian_phone, guardian_email, guardian_consent_at, terms_accepted_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now()) RETURNING id`,
    [d.email, d.name, d.phone, hash, d.isMinor, d.isMinor ? d.guardianName : "", d.isMinor ? U.normalizePhone(d.guardianPhone) : "", d.isMinor ? d.guardianEmail : "", d.isMinor ? new Date() : null]);
  await audit(u.id, "signup", "user", u.id, { isMinor: d.isMinor });
  await auth.startSession(res, cfg, u.id);
  res.status(201).json({ ok: true });
});

router.post("/auth/login", limit(20, 15), async (req, res) => {
  const d = parse(z.object({ email, password: z.string().min(1, "Enter your password.").max(200) }), req.body, res); if (!d) return;
  const u = await db.one("SELECT id, password_hash FROM users WHERE lower(email) = $1", [d.email]);
  if (!u || !(await auth.checkPassword(d.password, u.password_hash))) return fail(res, "That email and password do not match.", 401);
  await auth.startSession(res, cfg, u.id);
  res.json({ ok: true });
});

router.post("/auth/logout", async (req, res) => { await auth.endSession(req, res, cfg); res.json({ ok: true }); });
router.get("/auth/me", (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

router.post("/auth/forgot", limit(6, 60), async (req, res) => {
  const d = parse(z.object({ email }), req.body, res); if (!d) return;
  const u = await db.one("SELECT id, name FROM users WHERE lower(email) = $1", [d.email]);
  if (u && mail.configured()) {
    const t = U.token(24);
    await db.query("INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES ($1, $2, now() + interval '1 hour')", [U.sha256(t), u.id]);
    const link = U.baseUrl(cfg, req) + "/reset-password?token=" + encodeURIComponent(t);
    await mail.send({ to: d.email, ...mail.templates.passwordReset(u.name, link) });
  }
  res.json({ ok: true, emailEnabled: mail.configured() });
});

router.post("/auth/reset", limit(10, 60), async (req, res) => {
  const d = parse(z.object({ token: z.string().min(10).max(200), password: z.string().min(8, "Use at least 8 characters for your password.").max(200) }), req.body, res); if (!d) return;
  const r = await db.one("SELECT user_id FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()", [U.sha256(d.token)]);
  if (!r) return fail(res, "This reset link has expired or was already used. Ask for a new one.", 400);
  await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await auth.hashPassword(d.password), r.user_id]);
  await db.query("UPDATE password_resets SET used_at = now() WHERE token_hash = $1", [U.sha256(d.token)]);
  await db.query("DELETE FROM sessions WHERE user_id = $1", [r.user_id]);
  await audit(r.user_id, "password_reset", "user", r.user_id);
  await auth.startSession(res, cfg, r.user_id);
  res.json({ ok: true });
});

router.get("/me/bookings", auth.requireUser, async (req, res) => {
  const rows = await db.many("SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100", [req.user.id]);
  res.json({ bookings: rows.map((b) => ({ ...publicBooking(b), token: b.access_token })) });
});

router.post("/me/data-request", auth.requireUser, limit(5, 60), async (req, res) => {
  const d = parse(z.object({ type: z.enum(["access", "correction", "deletion", "withdraw_consent"]), details: optText(2000) }), req.body, res); if (!d) return;
  const id = await uniqueId("QT-", 6, "messages");
  const subject = { access: "Copy of my data", correction: "Correct my data", deletion: "Delete my account and data", withdraw_consent: "Withdraw my consent" }[d.type];
  await db.query("INSERT INTO messages (id, kind, name, email, phone, subject, body) VALUES ($1,'data_request',$2,$3,$4,$5,$6)",
    [id, req.user.name, req.user.email, req.user.phone, subject, d.details || subject]);
  const m = { id, kind: "data_request", name: req.user.name, email: req.user.email, phone: req.user.phone, subject, body: d.details || subject };
  mail.send({ to: req.user.email, ...mail.templates.ticketAck(m) });
  mail.send({ to: cfg.adminNotifyEmail, ...mail.templates.messageAdmin(m, U.baseUrl(cfg, req) + "/admin") });
  await audit(req.user.id, "data_request", "message", id, { type: d.type });
  res.status(201).json({ id });
});

/* ---------- bookings ---------- */
function publicBooking(b) {
  const t = C.track(b.track);
  return {
    id: b.id, itemId: b.item_id, itemName: b.item_name, kind: b.kind, amount: b.amount,
    track: b.track, trackName: t ? t.name : b.track, focus: b.focus, topic: b.topic,
    slots: (b.slots || []).map((s) => ({ ...s, label: C.slotLabel(s) })),
    name: b.name, isMinor: b.is_minor,
    paymentMethod: b.payment_method, paymentStatus: b.payment_status, utrLast4: b.utr ? b.utr.slice(-4) : "",
    status: b.status, confirmedSlot: b.confirmed_slot,
    meetingLink: b.status === "confirmed" || b.status === "completed" ? b.meeting_link : "",
    createdAt: b.created_at
  };
}
const forMail = (b) => ({ ...b, track_name: (C.track(b.track) || {}).name, slots: (b.slots || []).map((s) => ({ label: C.slotLabel(s) })) });
const statusLink = (req, b) => U.baseUrl(cfg, req) + "/booking/" + b.id + "?t=" + encodeURIComponent(b.access_token);

const bookingSchema = z.object({
  itemId: z.string().refine((v) => !!C.item(v), "Choose a plan or a session."),
  track: z.string().refine((v) => !!C.track(v), "Choose a mentorship track."),
  focus: optText(120),
  about: z.string().refine((v) => C.ABOUT.includes(v), "Tell us who you are."),
  topic: text(4, 300, "What you want help with"),
  notes: optText(1000),
  slots: z.array(z.object({ date: z.string(), time: z.string() })).min(1, "Pick at least one slot.").max(2, "Pick at most two slots.")
    .refine((s) => s.every((x) => C.isValidSlot(x)), "One of the slots is no longer available. Please pick again.")
    .refine((s) => new Set(s.map((x) => x.date + x.time)).size === s.length, "Pick two different slots."),
  name: text(2, 80, "Name"), phone: phone("Your WhatsApp number"), email: optEmail,
  isMinor: z.boolean().default(false),
  guardianName: optText(80), guardianPhone: z.string().optional().default(""), guardianEmail: optEmail, guardianConsent: z.boolean().default(false),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please accept the Terms, Privacy Policy and Refund policy." }) })
}).superRefine((d, ctx) => {
  if (!d.isMinor) return;
  if (d.guardianName.length < 2) ctx.addIssue({ code: "custom", message: "Add the parent or guardian’s name." });
  if (!U.normalizePhone(d.guardianPhone)) ctx.addIssue({ code: "custom", message: "Add the parent or guardian’s 10-digit mobile number." });
  if (!d.guardianConsent) ctx.addIssue({ code: "custom", message: "A parent or guardian must give consent for learners under 18." });
});

router.post("/bookings", limit(15, 60), async (req, res) => {
  const d = parse(bookingSchema, req.body, res); if (!d) return;
  const it = C.item(d.itemId);
  const id = await uniqueId("QV-", 6, "bookings");
  const tok = U.token(18);
  await db.query(
    `INSERT INTO bookings (id, access_token, user_id, item_id, item_name, kind, amount, track, focus, about, topic, notes, slots,
       name, phone, email, is_minor, guardian_name, guardian_phone, guardian_email, guardian_consent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
    [id, tok, req.user ? req.user.id : null, it.id, it.name + (C.isPlan(it.id) ? " plan" : ""), C.isPlan(it.id) ? "plan" : "single", it.price,
      d.track, d.focus, d.about, d.topic, d.notes, JSON.stringify(d.slots), d.name, d.phone, d.email,
      d.isMinor, d.isMinor ? d.guardianName : "", d.isMinor ? U.normalizePhone(d.guardianPhone) : "", d.isMinor ? d.guardianEmail : "", d.isMinor && d.guardianConsent]);
  await audit(req.user ? req.user.id : null, "booking_created", "booking", id, { item: it.id, amount: it.price });
  res.status(201).json({
    id, token: tok, amount: it.price, itemName: it.name,
    upi: { id: cfg.upiId, payee: cfg.upiPayee, link: U.upiLink(cfg, it.price, id) },
    cashfree: { enabled: cf.enabled(), mode: cf.mode() },
    statusUrl: "/booking/" + id + "?t=" + encodeURIComponent(tok)
  });
});

async function bookingFor(req, res, tok) {
  const b = await db.one("SELECT * FROM bookings WHERE id = $1", [String(req.params.id).toUpperCase()]);
  if (!b || !tok || !U.safeEqual(tok, b.access_token)) { fail(res, "We could not find that booking. Check the link and try again.", 404); return null; }
  return b;
}

async function notifyPaid(req, b) {
  const link = statusLink(req, b);
  if (b.email) mail.send({ to: b.email, ...mail.templates.bookingReceived(forMail(b), link) });
  if (b.is_minor && b.guardian_email && b.guardian_email !== b.email) mail.send({ to: b.guardian_email, ...mail.templates.bookingReceived(forMail(b), link) });
  mail.send({ to: cfg.adminNotifyEmail, ...mail.templates.bookingAdmin(forMail(b), U.baseUrl(cfg, req) + "/admin#booking=" + b.id) });
}

router.post("/bookings/:id/utr", limit(20, 60), async (req, res) => {
  const d = parse(z.object({ token: z.string().max(100), utr: z.string().trim().regex(/^\d{12}$/, "Enter the 12-digit UPI reference (UTR) from your payment app.") }), req.body, res); if (!d) return;
  const b = await bookingFor(req, res, d.token); if (!b) return;
  if (!["pending", "failed"].includes(b.payment_status)) return fail(res, "Payment details for this booking were already received.", 409);
  const dup = await db.one("SELECT id FROM bookings WHERE utr = $1 AND id <> $2", [d.utr, b.id]);
  if (dup) return fail(res, "This UPI reference was already used for another booking. Check the number in your payment app.", 409);
  const nb = await db.one("UPDATE bookings SET utr = $1, payment_method = 'upi', payment_status = 'submitted', updated_at = now() WHERE id = $2 RETURNING *", [d.utr, b.id]);
  await audit(null, "utr_submitted", "booking", b.id);
  notifyPaid(req, nb);
  res.json({ booking: publicBooking(nb) });
});

router.post("/bookings/:id/cashfree", limit(20, 60), async (req, res) => {
  if (!cf.enabled()) return fail(res, "Online payments are coming soon. Please pay by UPI for now.", 400);
  const d = parse(z.object({ token: z.string().max(100) }), req.body, res); if (!d) return;
  const b = await bookingFor(req, res, d.token); if (!b) return;
  if (["paid", "verified", "submitted"].includes(b.payment_status)) return fail(res, "This booking is already paid.", 409);
  const orderId = b.id + "-" + U.rid(4);
  const base = U.baseUrl(cfg, req);
  try {
    const o = await cf.createOrder({
      orderId, amount: b.amount, note: b.item_name + " " + b.id,
      customer: { id: "cust_" + b.phone, phone: b.phone, name: b.name, email: b.email },
      returnUrl: base + "/booking/" + b.id + "?t=" + encodeURIComponent(b.access_token) + "&order_id=" + orderId,
      notifyUrl: base + "/api/webhooks/cashfree"
    });
    await db.query("INSERT INTO payments (order_id, booking_id, amount, status, raw) VALUES ($1,$2,$3,$4,$5)", [orderId, b.id, b.amount, o.order_status || "ACTIVE", JSON.stringify(o)]);
    await db.query("UPDATE bookings SET payment_method = 'cashfree', cf_order_id = $1, updated_at = now() WHERE id = $2", [orderId, b.id]);
    res.json({ paymentSessionId: o.payment_session_id, orderId, mode: cf.mode() });
  } catch (e) {
    console.error("[cashfree] create order failed", e.status, e.message);
    fail(res, "Online payment could not start. Please try again or pay by UPI.", 502);
  }
});

async function markCashfree(req, orderId, status, raw) {
  const p = await db.one("SELECT * FROM payments WHERE order_id = $1", [orderId]);
  if (!p) return null;
  await db.query("UPDATE payments SET status = $1, raw = $2, updated_at = now() WHERE order_id = $3", [status, raw ? JSON.stringify(raw) : null, orderId]);
  if (status === "PAID") {
    const nb = await db.one("UPDATE bookings SET payment_status = 'paid', updated_at = now() WHERE id = $1 AND payment_status <> 'paid' RETURNING *", [p.booking_id]);
    if (nb) { await audit(null, "payment_paid", "booking", nb.id, { orderId }); notifyPaid(req, nb); }
  } else if (status === "FAILED") {
    await db.query("UPDATE bookings SET payment_status = 'failed', updated_at = now() WHERE id = $1 AND payment_status = 'pending'", [p.booking_id]);
  }
  return db.one("SELECT * FROM bookings WHERE id = $1", [p.booking_id]);
}

router.get("/bookings/:id", async (req, res) => {
  let b = await bookingFor(req, res, req.query.t); if (!b) return;
  if (b.payment_method === "cashfree" && b.cf_order_id && b.payment_status === "pending" && cf.enabled()) {
    try {
      const o = await cf.getOrder(b.cf_order_id);
      if (o.order_status === "PAID") b = (await markCashfree(req, b.cf_order_id, "PAID", o)) || b;
    } catch (e) { console.error("[cashfree] get order failed", e.status, e.message); }
  }
  res.json({ booking: publicBooking(b) });
});

// Cashfree server-to-server webhook. Mounted with a raw body parser in server.js.
async function cashfreeWebhook(req, res) {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
  if (!cf.enabled() || !cf.verifyWebhook(raw, req.get("x-webhook-timestamp"), req.get("x-webhook-signature"))) return res.status(400).json({ error: "invalid signature" });
  let ev;
  try { ev = JSON.parse(raw); } catch (e) { return res.status(400).json({ error: "invalid json" }); }
  const orderId = ev && ev.data && ev.data.order && ev.data.order.order_id;
  const ps = ev && ev.data && ev.data.payment && ev.data.payment.payment_status;
  if (orderId) {
    if (ps === "SUCCESS") await markCashfree(req, orderId, "PAID", ev);
    else if (ps === "FAILED" || ps === "USER_DROPPED") await markCashfree(req, orderId, "FAILED", ev);
  }
  res.json({ ok: true });
}

/* ---------- mentor applications ---------- */
const applicationSchema = z.object({
  name: text(2, 80, "Name"), email, phone: phone("Phone"), city: text(2, 80, "City"),
  tracks: z.array(z.string()).min(1, "Choose at least one track.").max(6).refine((a) => a.every((t) => !!C.track(t)), "Choose tracks from the list."),
  jobRole: text(2, 120, "Current role"),
  experienceYears: z.coerce.number({ invalid_type_error: "Years of experience must be a number." }).int().min(0).max(60),
  linkedin: z.union([z.literal(""), z.string().trim().max(300).url("Enter a full LinkedIn or portfolio link starting with https://").refine((u) => /^https:\/\//.test(u), "Links must start with https://")]).optional().default(""),
  languages: optText(120),
  hoursPerMonth: z.coerce.number({ invalid_type_error: "Hours per month must be a number." }).int().min(1, "Hours per month must be at least 1.").max(200),
  why: text(20, 1500, "A few lines about why you want to mentor"),
  consent: z.literal(true, { errorMap: () => ({ message: "Please agree to be contacted about your application." }) })
});

router.post("/mentor-applications", limit(5, 60), async (req, res) => {
  const d = parse(applicationSchema, req.body, res); if (!d) return;
  const id = await uniqueId("MA-", 5, "mentor_applications");
  await db.query(
    `INSERT INTO mentor_applications (id, name, email, phone, city, tracks, job_role, experience_years, linkedin, languages, hours_per_month, why)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id, d.name, d.email, d.phone, d.city, JSON.stringify(d.tracks), d.jobRole, d.experienceYears, d.linkedin, d.languages, d.hoursPerMonth, d.why]);
  const a = { id, name: d.name, job_role: d.jobRole, experience_years: d.experienceYears, city: d.city, tracks: d.tracks.map((t) => C.track(t).name), why: d.why };
  mail.send({ to: d.email, ...mail.templates.applicationReceived(a) });
  mail.send({ to: cfg.adminNotifyEmail, ...mail.templates.applicationAdmin(a, U.baseUrl(cfg, req) + "/admin#applications") });
  await audit(null, "application_created", "application", id);
  res.status(201).json({ id });
});

/* ---------- enquiries and grievances ---------- */
const messageSchema = z.object({
  kind: z.enum(["enquiry", "grievance"]).default("enquiry"),
  name: text(2, 80, "Name"), email: optEmail, phone: z.string().optional().default(""),
  subject: optText(140), body: text(10, 3000, "Your message"), bookingId: optText(20)
}).superRefine((d, ctx) => {
  if (!d.email && !U.normalizePhone(d.phone)) ctx.addIssue({ code: "custom", message: "Add an email address or a 10-digit mobile number so we can reply." });
});

router.post("/messages", limit(6, 60), async (req, res) => {
  const d = parse(messageSchema, req.body, res); if (!d) return;
  const id = await uniqueId("QT-", 6, "messages");
  const ph = U.normalizePhone(d.phone);
  await db.query("INSERT INTO messages (id, kind, name, email, phone, subject, body, booking_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
    [id, d.kind, d.name, d.email, ph, d.subject, d.body, d.bookingId.toUpperCase()]);
  const m = { id, kind: d.kind, name: d.name, email: d.email, phone: ph, subject: d.subject, body: d.body };
  if (d.email) mail.send({ to: d.email, ...mail.templates.ticketAck(m) });
  mail.send({ to: d.kind === "grievance" ? cfg.grievance.email : cfg.adminNotifyEmail, ...mail.templates.messageAdmin(m, U.baseUrl(cfg, req) + "/admin#messages") });
  await audit(null, "message_created", "message", id, { kind: d.kind });
  res.status(201).json({ id });
});

module.exports = { router, cashfreeWebhook, audit, publicBooking, forMail, statusLink, uniqueId };
