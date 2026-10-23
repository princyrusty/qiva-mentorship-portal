"use strict";
// Cookie sessions stored in Postgres. The cookie holds a random token; the database stores only its SHA-256 hash.
const bcrypt = require("bcryptjs");
const db = require("./db");
const { token, sha256 } = require("./util");

const COOKIE = "qiva_sid";

function cookieOpts(cfg) {
  return { httpOnly: true, sameSite: "lax", secure: cfg.isProd, path: "/", maxAge: cfg.sessionDays * 864e5 };
}

const hashPassword = (pw) => bcrypt.hash(pw, 11);
const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

async function startSession(res, cfg, userId) {
  const t = token(32);
  await db.query("INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3::int))", [sha256(t), userId, cfg.sessionDays]);
  await db.query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
  res.cookie(COOKIE, t, cookieOpts(cfg));
}

async function endSession(req, res, cfg) {
  const t = req.cookies && req.cookies[COOKIE];
  if (t) await db.query("DELETE FROM sessions WHERE id = $1", [sha256(t)]);
  res.clearCookie(COOKIE, { ...cookieOpts(cfg), maxAge: undefined });
}

function loadUser() {
  return async (req, res, next) => {
    req.user = null;
    const t = req.cookies && req.cookies[COOKIE];
    if (!t) return next();
    try {
      req.user = await db.one(
        `SELECT u.id, u.email, u.name, u.phone, u.role, u.is_minor, u.guardian_name, u.guardian_phone, u.guardian_email
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id = $1 AND s.expires_at > now()`, [sha256(t)]);
    } catch (e) {
      console.error("[auth] session lookup failed", e.message);
    }
    next();
  };
}

const requireUser = (req, res, next) => (req.user ? next() : res.status(401).json({ error: "Please sign in to continue." }));
const requireAdmin = (req, res, next) =>
  req.user && req.user.role === "admin" ? next() : res.status(req.user ? 403 : 401).json({ error: "Admin access only." });

module.exports = { hashPassword, checkPassword, startSession, endSession, loadUser, requireUser, requireAdmin, COOKIE };
