"use strict";
// Transactional email through Resend's HTTPS API. Render's free tier blocks SMTP ports, so an HTTP API is required.
// Without RESEND_API_KEY every send is skipped and logged, and the rest of the app keeps working.
const cfg = require("./config");
const { esc, inr } = require("./util");

async function send({ to, subject, html, replyTo }) {
  const list = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!list.length) return { skipped: "no recipient" };
  if (!cfg.email.resendKey) {
    console.log(`[email] skipped (RESEND_API_KEY not set): "${subject}" to ${list.join(", ")}`);
    return { skipped: "not configured" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + cfg.email.resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({ from: cfg.email.from, to: list, subject, html, reply_to: replyTo || cfg.email.replyTo })
    });
    if (!r.ok) {
      const body = await r.text();
      console.error(`[email] Resend ${r.status}: ${body.slice(0, 300)}`);
      return { error: r.status };
    }
    return { ok: true };
  } catch (e) {
    console.error("[email] send failed", e.message);
    return { error: e.message };
  }
}

function frame(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#F6F7F2;font-family:Arial,Helvetica,sans-serif;color:#17150F">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E4E4DC;border-radius:18px">
  <tr><td style="padding:22px 26px;border-bottom:1px solid #E4E4DC;font-size:20px;font-weight:bold">QIVA <span style="color:#6B675C;font-weight:normal;font-size:15px">Mentorship</span></td></tr>
  <tr><td style="padding:24px 26px;font-size:15px;line-height:1.6">
  <h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}</td></tr>
  <tr><td style="padding:18px 26px;border-top:1px solid #E4E4DC;font-size:12.5px;color:#6B675C;line-height:1.5">
  ${esc(cfg.company.legalName)}, ${esc(cfg.company.address)}<br>WhatsApp ${esc(cfg.whatsappDisplay)} · ${esc(cfg.supportEmail)}</td></tr>
  </table></td></tr></table></body></html>`;
}

const row = (k, v) => `<tr><td style="padding:6px 12px 6px 0;color:#6B675C;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-weight:bold">${v}</td></tr>`;

function bookingTable(b) {
  const slots = (b.slots || []).map((s) => esc(s.label || s)).join("<br>");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0">${row("Booking ID", esc(b.id))}${row("Booking", esc(b.item_name) + " · " + inr(b.amount))}${row("Track", esc(b.track_name || b.track) + (b.focus ? " · " + esc(b.focus) : ""))}${row("Preferred slots", slots)}</table>`;
}

const templates = {
  bookingReceived: (b, link) => ({
    subject: `We received your booking ${b.id}`,
    html: frame("Your booking is in", `<p>Hi ${esc(b.name)}, thank you for booking with QIVA. We will check your payment and confirm one of your slots on WhatsApp, usually within 2 to 4 hours during support hours.</p>${bookingTable(b)}<p><a href="${esc(link)}" style="display:inline-block;background:#17150F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">View your booking</a></p>`)
  }),
  bookingAdmin: (b, link) => ({
    subject: `New booking ${b.id}: ${b.item_name} (${inr(b.amount)})`,
    html: frame("New booking", `<p>${esc(b.name)} (+91 ${esc(b.phone)}${b.email ? ", " + esc(b.email) : ""}) booked ${esc(b.item_name)}.</p>${bookingTable(b)}<p>Topic: ${esc(b.topic)}</p><p>Payment: ${esc(b.payment_method)}${b.utr ? " · UTR " + esc(b.utr) : ""} · ${esc(b.payment_status)}</p>${b.is_minor ? `<p><strong>Learner is under 18.</strong> Guardian: ${esc(b.guardian_name)}, +91 ${esc(b.guardian_phone)}. Verify the guardian before confirming.</p>` : ""}<p><a href="${esc(link)}">Open the admin panel</a></p>`)
  }),
  bookingConfirmed: (b, link) => ({
    subject: `Confirmed: your QIVA session ${b.id}`,
    html: frame("Your session is confirmed", `<p>Hi ${esc(b.name)}, your session is confirmed for <strong>${esc(b.confirmed_slot)}</strong>.</p>${b.meeting_link ? `<p>Join your private room at that time:<br><a href="${esc(b.meeting_link)}">${esc(b.meeting_link)}</a></p>` : ""}<p>Notes and action points arrive by email after the session.</p><p><a href="${esc(link)}">View your booking</a></p>`)
  }),
  bookingCancelled: (b, link) => ({
    subject: `Update on your booking ${b.id}`,
    html: frame("Your booking was cancelled", `<p>Hi ${esc(b.name)}, booking ${esc(b.id)} has been cancelled. If you paid, the refund follows our Refund and Cancellation policy and reaches the account you paid from within 5 to 7 working days.</p><p><a href="${esc(link)}">View your booking</a></p>`)
  }),
  applicationReceived: (a) => ({
    subject: "Thanks for applying to mentor with QIVA",
    html: frame("We received your application", `<p>Hi ${esc(a.name)}, thank you for offering your time. Your application reference is <strong>${esc(a.id)}</strong>. We will reply on WhatsApp or email to set up a short intro call.</p>`)
  }),
  applicationAdmin: (a, link) => ({
    subject: `New mentor application ${a.id}: ${a.name}`,
    html: frame("New mentor application", `<p>${esc(a.name)} · ${esc(a.job_role)} · ${esc(a.experience_years)} years · ${esc(a.city)}</p><p>Tracks: ${esc((a.tracks || []).join(", "))}</p><p>${esc(a.why)}</p><p><a href="${esc(link)}">Open the admin panel</a></p>`)
  }),
  ticketAck: (m) => ({
    subject: `We received your message (ticket ${m.id})`,
    html: frame("Message received", `<p>Hi ${esc(m.name)}, we have logged your ${m.kind === "grievance" ? "complaint" : m.kind === "data_request" ? "data request" : "message"} as ticket <strong>${esc(m.id)}</strong>. ${m.kind === "grievance" ? "Our Grievance Officer acknowledges complaints within 48 hours and aims to resolve them within one month." : m.kind === "data_request" ? "We respond to data requests within 90 days, and usually much sooner." : "We reply during support hours."}</p>`)
  }),
  messageAdmin: (m, link) => ({
    subject: `New ${m.kind.replace("_", " ")} ${m.id}: ${m.subject || m.name}`,
    html: frame("New message", `<p>${esc(m.name)} · ${esc(m.email)} · ${esc(m.phone)}</p><p><strong>${esc(m.subject)}</strong></p><p style="white-space:pre-wrap">${esc(m.body)}</p><p><a href="${esc(link)}">Open the admin panel</a></p>`)
  }),
  passwordReset: (name, link) => ({
    subject: "Reset your QIVA password",
    html: frame("Reset your password", `<p>Hi ${esc(name)}, use the button below within one hour to choose a new password. If you did not ask for this, you can ignore this email.</p><p><a href="${esc(link)}" style="display:inline-block;background:#17150F;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Choose a new password</a></p>`)
  })
};

module.exports = { send, templates, configured: () => Boolean(cfg.email.resendKey) };
