"use strict";
// Admin API. First-run setup creates the owner account using ADMIN_SETUP_CODE; everything else needs an admin session.
const express = require("express");
const { z } = require("zod");
const rateLimit = require("express-rate-limit");
const cfg = require("./config");
const db = require("./db");
const C = require("../public/catalog");
const U = require("./util");
const auth = require("./auth");
const mail = require("./email");
const { audit, publicBooking, forMail, statusLink } = require("./api");

const router = express.Router();
const fail = (res, msg, code = 400) => res.status(code).json({ error: msg });
function parse(schema, body, res) {
  const r = schema.safeParse(body || {});
  if (!r.success) { fail(res, (r.error.issues[0] && r.error.issues[0].message) || "Please check the form."); return null; }
  return r.data;
}

/* ---------- first-run owner setup ---------- */
router.get("/setup-status", async (req, res) => {
  const admin = await db.one("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1");
  res.json({ needsSetup: !admin, codeConfigured: Boolean(cfg.setupCode) });
});

router.post("/setup", rateLimit({ windowMs: 15 * 60e3, limit: 10, standardHeaders: "draft-7", legacyHeaders: false }), async (req, res) => {
  if (await db.one("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1")) return fail(res, "The owner account already exists. Sign in instead.", 409);
  if (!cfg.setupCode) return fail(res, "Set ADMIN_SETUP_CODE in the server environment first.", 400);
  const d = parse(z.object({
    code: z.string().min(1, "Enter the setup code."),
    name: z.string().trim().min(2, "Enter your name.").max(80),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z.string().min(10, "Use at least 10 characters for the owner password.").max(200)
  }), req.body, res); if (!d) return;
  if (!U.safeEqual(d.code, cfg.setupCode)) return fail(res, "That setup code is not right.", 403);
  const hash = await auth.hashPassword(d.password);
  const existing = await db.one("SELECT id FROM users WHERE lower(email) = $1", [d.email]);
  let id;
  if (existing) { await db.query("UPDATE users SET role = 'admin', password_hash = $1, name = $2 WHERE id = $3", [hash, d.name, existing.id]); id = existing.id; }
  else id = (await db.one("INSERT INTO users (email, name, password_hash, role, terms_accepted_at) VALUES ($1,$2,$3,'admin', now()) RETURNING id", [d.email, d.name, hash])).id;
  await audit(id, "admin_setup", "user", id);
  await auth.startSession(res, cfg, id);
  res.status(201).json({ ok: true });
});

router.use(auth.requireAdmin);

/* ---------- dashboard ---------- */
router.get("/summary", async (req, res) => {
  const [b, rev, apps, msgs, minors] = await Promise.all([
    db.many("SELECT payment_status, status, count(*)::int AS n FROM bookings GROUP BY payment_status, status"),
    db.one("SELECT coalesce(sum(amount), 0)::int AS total, count(*)::int AS n FROM bookings WHERE payment_status IN ('verified', 'paid') AND status <> 'cancelled'"),
    db.one("SELECT count(*) FILTER (WHERE status = 'new')::int AS new, count(*)::int AS total FROM mentor_applications"),
    db.one("SELECT count(*) FILTER (WHERE status = 'open')::int AS open, count(*) FILTER (WHERE status = 'open' AND kind = 'grievance')::int AS grievances, count(*) FILTER (WHERE status <> 'resolved' AND kind = 'grievance' AND created_at < now() - interval '48 hours' AND acknowledged_at IS NULL)::int AS overdue FROM messages"),
    db.one("SELECT count(*)::int AS n FROM bookings WHERE is_minor AND NOT guardian_verified AND status = 'requested' AND payment_status IN ('submitted', 'verified', 'paid')")
  ]);
  const sum = (f) => b.filter(f).reduce((a, r) => a + r.n, 0);
  res.json({
    toVerify: sum((r) => r.payment_status === "submitted" && r.status !== "cancelled"),
    toConfirm: sum((r) => ["verified", "paid"].includes(r.payment_status) && r.status === "requested"),
    confirmed: sum((r) => r.status === "confirmed"),
    awaitingPayment: sum((r) => r.payment_status === "pending" && r.status !== "cancelled"),
    revenue: rev.total, paidBookings: rev.n,
    newApplications: apps.new, applications: apps.total,
    openMessages: msgs.open, openGrievances: msgs.grievances, overdueGrievances: msgs.overdue,
    minorsToVerify: minors.n,
    emailEnabled: mail.configured(), database: db.kind()
  });
});

/* ---------- bookings ---------- */
router.get("/bookings", async (req, res) => {
  const where = [];
  const params = [];
  const f = String(req.query.filter || "active");
  if (f === "verify") where.push("payment_status = 'submitted' AND status <> 'cancelled'");
  else if (f === "confirm") where.push("payment_status IN ('verified', 'paid') AND status = 'requested'");
  else if (f === "upcoming") where.push("status = 'confirmed'");
  else if (f === "unpaid") where.push("payment_status IN ('pending', 'failed') AND status <> 'cancelled'");
  else if (f === "done") where.push("status IN ('completed', 'cancelled')");
  else if (f === "active") where.push("status IN ('requested', 'confirmed') AND payment_status <> 'pending'");
  const q = String(req.query.q || "").trim();
  if (q) { params.push("%" + q.toLowerCase() + "%"); where.push(`(lower(id) LIKE $${params.length} OR lower(name) LIKE $${params.length} OR phone LIKE $${params.length} OR lower(email) LIKE $${params.length} OR coalesce(utr, '') LIKE $${params.length})`); }
  const rows = await db.many(`SELECT * FROM bookings ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 300`, params);
  res.json({ bookings: rows.map(adminBooking) });
});

function adminBooking(b) {
  return {
    ...publicBooking(b), meetingLink: b.meeting_link, phone: b.phone, email: b.email, about: b.about, notes: b.notes, utr: b.utr || "",
    guardianName: b.guardian_name, guardianPhone: b.guardian_phone, guardianEmail: b.guardian_email, guardianConsent: b.guardian_consent, guardianVerified: b.guardian_verified,
    cfOrderId: b.cf_order_id || "", adminNotes: b.admin_notes, userId: b.user_id, updatedAt: b.updated_at, accessToken: b.access_token
  };
}

router.get("/bookings/:id", async (req, res) => {
  const b = await db.one("SELECT * FROM bookings WHERE id = $1", [req.params.id.toUpperCase()]);
  if (!b) return fail(res, "Booking not found.", 404);
  const log = await db.many("SELECT action, details, created_at FROM audit_log WHERE entity = 'booking' AND entity_id = $1 ORDER BY created_at DESC LIMIT 50", [b.id]);
  res.json({ booking: adminBooking(b), log });
});

const patchSchema = z.object({
  paymentStatus: z.enum(["pending", "submitted", "verified", "paid", "failed", "refunded"]).optional(),
  status: z.enum(["requested", "confirmed", "completed", "cancelled"]).optional(),
  confirmedSlot: z.string().trim().max(120).optional(),
  meetingLink: z.union([z.literal(""), z.string().trim().max(300).url("Enter a full meeting link starting with https://")]).optional(),
  guardianVerified: z.boolean().optional(),
  adminNotes: z.string().max(4000).optional()
});

router.patch("/bookings/:id", async (req, res) => {
  const d = parse(patchSchema, req.body, res); if (!d) return;
  const b = await db.one("SELECT * FROM bookings WHERE id = $1", [req.params.id.toUpperCase()]);
  if (!b) return fail(res, "Booking not found.", 404);
  const next = {
    payment_status: d.paymentStatus ?? b.payment_status, status: d.status ?? b.status,
    confirmed_slot: d.confirmedSlot ?? b.confirmed_slot, meeting_link: d.meetingLink ?? b.meeting_link,
    guardian_verified: d.guardianVerified ?? b.guardian_verified, admin_notes: d.adminNotes ?? b.admin_notes
  };
  if (next.status === "confirmed" && b.status !== "confirmed") {
    if (!["verified", "paid"].includes(next.payment_status)) return fail(res, "Verify the payment before confirming the session.");
    if (!next.confirmed_slot) return fail(res, "Choose the confirmed slot first.");
    if (b.is_minor && !next.guardian_verified) return fail(res, "This learner is under 18. Verify the parent or guardian before confirming.");
    if (!next.meeting_link) next.meeting_link = "https://meet.jit.si/QIVA-" + b.id.replace("-", "") + "-" + U.rid(4);
  }
  const nb = await db.one(
    `UPDATE bookings SET payment_status = $1, status = $2, confirmed_slot = $3, meeting_link = $4, guardian_verified = $5, admin_notes = $6, updated_at = now()
      WHERE id = $7 RETURNING *`,
    [next.payment_status, next.status, next.confirmed_slot, next.meeting_link, next.guardian_verified, next.admin_notes, b.id]);
  const changed = Object.keys(next).filter((k) => String(next[k]) !== String(b[k]) && k !== "admin_notes");
  if (changed.length || d.adminNotes !== undefined) await audit(req.user.id, "booking_updated", "booking", b.id, { changed, from: Object.fromEntries(changed.map((k) => [k, b[k]])), to: Object.fromEntries(changed.map((k) => [k, next[k]])) });
  const link = statusLink(req, nb);
  const recipients = [nb.email, nb.is_minor ? nb.guardian_email : ""].filter(Boolean);
  if (nb.status === "confirmed" && b.status !== "confirmed" && recipients.length) mail.send({ to: recipients, ...mail.templates.bookingConfirmed(forMail(nb), link) });
  if (nb.status === "cancelled" && b.status !== "cancelled" && recipients.length) mail.send({ to: recipients, ...mail.templates.bookingCancelled(forMail(nb), link) });
  res.json({ booking: adminBooking(nb) });
});

/* ---------- mentor applications ---------- */
router.get("/applications", async (req, res) => {
  const rows = await db.many("SELECT * FROM mentor_applications ORDER BY created_at DESC LIMIT 300");
  res.json({ applications: rows.map((a) => ({ ...a, trackNames: (a.tracks || []).map((t) => (C.track(t) || {}).name || t) })) });
});
router.patch("/applications/:id", async (req, res) => {
  const d = parse(z.object({ status: z.enum(["new", "shortlisted", "interview", "onboarded", "rejected"]).optional(), adminNotes: z.string().max(4000).optional() }), req.body, res); if (!d) return;
  const a = await db.one("UPDATE mentor_applications SET status = coalesce($1, status), admin_notes = coalesce($2, admin_notes), updated_at = now() WHERE id = $3 RETURNING *", [d.status ?? null, d.adminNotes ?? null, req.params.id.toUpperCase()]);
  if (!a) return fail(res, "Application not found.", 404);
  await audit(req.user.id, "application_updated", "application", a.id, { status: d.status });
  res.json({ application: a });
});

/* ---------- messages, grievances, data requests ---------- */
router.get("/messages", async (req, res) => {
  res.json({ messages: await db.many("SELECT * FROM messages ORDER BY (status = 'resolved'), created_at DESC LIMIT 300") });
});
router.patch("/messages/:id", async (req, res) => {
  const d = parse(z.object({ status: z.enum(["open", "acknowledged", "resolved"]).optional(), adminNotes: z.string().max(4000).optional() }), req.body, res); if (!d) return;
  const m = await db.one(
    `UPDATE messages SET status = coalesce($1, status), admin_notes = coalesce($2, admin_notes),
       acknowledged_at = CASE WHEN $1 IN ('acknowledged', 'resolved') AND acknowledged_at IS NULL THEN now() ELSE acknowledged_at END,
       resolved_at = CASE WHEN $1 = 'resolved' THEN now() WHEN $1 IS NOT NULL THEN NULL ELSE resolved_at END
     WHERE id = $3 RETURNING *`, [d.status ?? null, d.adminNotes ?? null, req.params.id.toUpperCase()]);
  if (!m) return fail(res, "Message not found.", 404);
  await audit(req.user.id, "message_updated", "message", m.id, { status: d.status });
  res.json({ message: m });
});

/* ---------- people and exports ---------- */
router.get("/users", async (req, res) => {
  res.json({ users: await db.many("SELECT id, name, email, phone, role, is_minor, guardian_name, guardian_phone, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT 500") });
});

const EXPORTS = {
  bookings: "SELECT id, created_at, name, phone, email, item_name, amount, track, focus, topic, slots, payment_method, utr, payment_status, status, confirmed_slot, meeting_link, is_minor, guardian_name, guardian_phone, guardian_verified, admin_notes FROM bookings ORDER BY created_at DESC",
  applications: "SELECT id, created_at, name, email, phone, city, tracks, job_role, experience_years, linkedin, languages, hours_per_month, why, status, admin_notes FROM mentor_applications ORDER BY created_at DESC",
  messages: "SELECT id, created_at, kind, name, email, phone, subject, body, booking_id, status, acknowledged_at, resolved_at, admin_notes FROM messages ORDER BY created_at DESC",
  users: "SELECT id, created_at, name, email, phone, role, is_minor, guardian_name, guardian_phone, guardian_email, last_login_at FROM users ORDER BY created_at DESC"
};
router.get("/export/:entity", async (req, res) => {
  const sql = EXPORTS[req.params.entity];
  if (!sql) return fail(res, "Unknown export.", 404);
  const rows = await db.many(sql);
  await audit(req.user.id, "export", req.params.entity, "all", { rows: rows.length });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="qiva-${req.params.entity}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send("﻿" + U.toCsv(rows));
});

module.exports = router;
