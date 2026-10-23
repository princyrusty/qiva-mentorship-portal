"use strict";
const crypto = require("crypto");

const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function rid(n) {
  const bytes = crypto.randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return out;
}
const token = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const inr = (n) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");

// Indian mobile numbers: accept +91, 91 or 0 prefixes and spaces; store the 10-digit number.
function normalizePhone(p) {
  const d = String(p || "").replace(/\D/g, "").replace(/^(?:91|0)(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(d) ? d : "";
}

function upiLink(cfg, amount, note) {
  const q = new URLSearchParams({ pa: cfg.upiId, pn: cfg.upiPayee, am: Number(amount).toFixed(2), cu: "INR", tn: note });
  return "upi://pay?" + q.toString().replace(/\+/g, "%20");
}

const waLink = (number, text) => "https://wa.me/" + number + "?text=" + encodeURIComponent(text);

function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v) => {
    if (v == null) return "";
    const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
    // Neutralise spreadsheet formula injection and quote every cell.
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  return [cols.map(cell).join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

function baseUrl(cfg, req) {
  if (cfg.siteUrl) return cfg.siteUrl;
  return req.protocol + "://" + req.get("host");
}

module.exports = { rid, token, sha256, safeEqual, esc, inr, normalizePhone, upiLink, waLink, toCsv, baseUrl };
