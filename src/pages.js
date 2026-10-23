"use strict";
// Server-rendered pages. Every page shares one layout so the header, footer, SEO tags and scripts stay consistent.
const fs = require("fs");
const path = require("path");
const cfg = require("./config");
const C = require("../public/catalog");
const { esc, baseUrl } = require("./util");

const ASSET_V = "1";
const HOME_BODY = fs.readFileSync(path.join(__dirname, "home.html"), "utf8");
const UPDATED = "23 October 2026";

const ico = (p, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const LOGO = `<svg width="34" height="30" viewBox="0 0 34 30" aria-hidden="true"><path d="M2 28 L13 8 L19 18 L23 12 L32 28 Z" fill="currentColor"/><circle cx="27" cy="6" r="4.2" fill="#F3A20F"/></svg>`;

function header(active) {
  const a = (href, label, key) => `<a href="${href}"${active === key ? ' aria-current="page"' : ""}>${label}</a>`;
  return `<header class="top"><nav class="nav" aria-label="Main">
    <a class="logo" href="/" aria-label="QIVA Mentorship home">${LOGO} QIVA <small>Mentorship</small></a>
    <div class="links">${a("/#tracks", "Tracks", "tracks")}${a("/#plans", "Plans", "plans")}${a("/#how", "How it works", "how")}${a("/mentor", "Become a mentor", "mentor")}${a("/#faq", "FAQ", "faq")}${a("/contact", "Contact", "contact")}</div>
    <div class="actions">
      <a class="btn btn-ghost btn-sm" href="/account" id="accountLink">${ico('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>', 18)}<span class="myreq-label" id="accountLabel">Sign in</span></a>
      <a class="btn btn-dark btn-sm" href="/#book" data-book><span class="book-label">Book a session</span><span class="book-short">Book</span></a>
      <button class="iconbtn menu-btn" type="button" id="menuBtn" aria-label="Open menu" aria-expanded="false" aria-controls="sheet">${ico('<path d="M4 7h16M4 12h16M4 17h16"/>')}</button>
    </div></nav></header>
  <div class="sheet" id="sheet" hidden><div class="sheet-panel" role="dialog" aria-modal="true" aria-label="Menu">
    <button class="iconbtn" type="button" id="sheetClose" aria-label="Close menu" style="align-self:flex-end">${ico('<path d="M6 6l12 12M18 6L6 18"/>', 18)}</button>
    <a href="/#tracks">Tracks</a><a href="/#plans">Plans</a><a href="/#how">How it works</a><a href="/mentor">Become a mentor</a><a href="/#faq">FAQ</a><a href="/contact">Contact</a><a href="/account">My account</a>
  </div></div>`;
}

function footer() {
  const g = cfg.grievance;
  return `<footer><div class="foot">
    <div style="display:flex;flex-direction:column;gap:10px">
      <strong class="foot-brand">QIVA Mentorship</strong>
      <p>A service of ${esc(cfg.company.legalName)}, ${esc(cfg.company.city)}. All prices include GST. Appointments are shown in Indian Standard Time.</p>
      <p><strong>Registered address:</strong> ${esc(cfg.company.legalName)}, ${esc(cfg.company.address)}.${cfg.company.cin ? " CIN " + esc(cfg.company.cin) + "." : ""}${cfg.company.gstin ? " GSTIN " + esc(cfg.company.gstin) + "." : ""}</p>
      <p><strong>Bookings (WhatsApp):</strong> ${esc(cfg.whatsappDisplay)} · <strong>Changes and cancellations:</strong> ${esc(cfg.supportPhone)} or ${esc(cfg.supportEmail)} · ${esc(cfg.supportHours)}</p>
      <p><strong>${esc(g.designation)}:</strong> ${g.name ? esc(g.name) + ", " : ""}${esc(g.email)}, ${esc(g.phone)}. Complaints are acknowledged within 48 hours.</p>
    </div>
    <nav class="links2" aria-label="Policies"><a href="/terms">Terms &amp; Conditions</a><a href="/privacy">Privacy Policy</a><a href="/refund-policy">Refund &amp; Cancellation</a><a href="/service-delivery">Service Delivery</a><a href="/contact">Contact &amp; Grievances</a><a href="/mentor">Become a mentor</a></nav>
  </div><p class="copy">&copy; 2026 ${esc(cfg.company.legalName)}. QIVA Mentorship is independent and is not operated or endorsed by any government office.</p></footer>`;
}

function layout(req, { title, description, path: p, body, scripts = [], active, jsonld, noindex, main = true }) {
  const base = baseUrl(cfg, req);
  const full = title ? `${title} · QIVA Mentorship` : "QIVA Mentorship Portal";
  const desc = description || "One-to-one mentorship for career guidance, study doubts, motivation, startups, AI and tech, and communication. Book by the session or by the month, with slots in IST and private video rooms.";
  const url = base + (p || "/");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
${noindex ? '<meta name="robots" content="noindex">' : ""}
<meta name="theme-color" content="#FFFFFF">
<meta property="og:type" content="website"><meta property="og:site_name" content="QIVA Mentorship">
<meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(base)}/og-image.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=IBM+Plex+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/site.css?v=${ASSET_V}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<div class="wrap">
${header(active)}
${main ? `<main id="main">${body}</main>` : body}
${footer()}
</div>
<div class="toast" id="toast" role="status" hidden></div>
<script src="/catalog.js?v=${ASSET_V}"></script>
<script src="/common.js?v=${ASSET_V}"></script>
${scripts.map((s) => `<script src="${s.startsWith("http") ? s : s + "?v=" + ASSET_V}"></script>`).join("\n")}
</body>
</html>`;
}

/* ---------- home ---------- */
function home(req) {
  const base = baseUrl(cfg, req);
  const FAQ = require("../public/faq.json");
  const jsonld = [
    { "@context": "https://schema.org", "@type": "EducationalOrganization", name: "QIVA Mentorship", legalName: cfg.company.legalName, url: base + "/",
      logo: base + "/favicon.svg", email: cfg.supportEmail, telephone: "+" + cfg.whatsapp,
      address: { "@type": "PostalAddress", streetAddress: "Tower B, Flat 106, Jalvayu Towers, Kahagra", addressLocality: "Dehradun", addressRegion: "Uttarakhand", addressCountry: "IN" },
      makesOffer: [...C.SINGLE, ...C.PLANS].map((x) => ({ "@type": "Offer", name: x.name + (C.isPlan(x.id) ? " plan" : ""), price: x.price, priceCurrency: "INR" })) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }
  ];
  return layout(req, { path: "/", body: HOME_BODY, active: "home", jsonld, main: false,
    scripts: ["https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js", "/booking-flow.js", "/home.js"] });
}

/* ---------- legal pages ---------- */
function legal(req, { title, slug, intro, html }) {
  return layout(req, { title, path: "/" + slug, description: intro, body: `<article class="doc">
    <span class="eyebrow">Policies</span><h1>${esc(title)}</h1><p class="lede">${esc(intro)}</p><p class="muted">Last updated ${UPDATED}.</p>
    <div class="doc-body">${html}</div></article>` });
}

const contactBlock = () => `<p><strong>${esc(cfg.company.legalName)}</strong><br>${esc(cfg.company.address)}<br>WhatsApp ${esc(cfg.whatsappDisplay)} · Phone ${esc(cfg.supportPhone)} · ${esc(cfg.supportEmail)}<br>${esc(cfg.supportHours)}</p>`;
const grievanceBlock = () => `<p><strong>${esc(cfg.grievance.designation)}${cfg.grievance.name ? ": " + esc(cfg.grievance.name) : ""}</strong><br>${esc(cfg.company.legalName)}, ${esc(cfg.company.address)}<br>Email ${esc(cfg.grievance.email)} · Phone ${esc(cfg.grievance.phone)}</p>`;

const terms = (req) => legal(req, { title: "Terms & Conditions", slug: "terms",
  intro: "The rules for booking and attending QIVA mentorship sessions and plans.",
  html: `<h2>1. Who we are</h2><p>QIVA Mentorship is a service of ${esc(cfg.company.legalName)} ("QIVA", "we"). By creating an account, booking a session or plan, or applying to mentor, you agree to these terms.</p>
  <h2>2. What we provide</h2><p>One-to-one mentorship sessions delivered online in a private video or voice room. Mentorship is guidance and accountability. It is not tuition with guaranteed results, and it is not medical, psychological, legal or financial advice. For mental health emergencies, contact Tele-MANAS on 14416 or your nearest hospital.</p>
  <h2>3. Eligibility and learners under 18</h2><p>You must be 18 or older to book on your own. A learner under 18 may book only with the knowledge and consent of a parent or lawful guardian, whose name and mobile number we collect. We confirm the guardian before the first session. Parents may ask us at any time about their child's sessions.</p>
  <h2>4. Bookings and payment</h2><ul><li>Prices are in Indian rupees and include GST. The price shown when you book is the price you pay.</li><li>A booking is placed after payment. For UPI payments you enter the 12-digit UPI reference (UTR), and we verify it before confirming your slot. When online payment is enabled, the payment gateway's receipt is your proof of payment.</li><li>We confirm one of your preferred slots on WhatsApp or email, usually within 2 to 4 hours during support hours. If we cannot offer any of your slots, we suggest new ones or refund you in full.</li><li>Monthly plans cover four sessions within 30 days of the first session. Plans are prepaid and do not renew automatically until automatic billing is announced on this page.</li></ul>
  <h2>5. Rescheduling, cancellation and refunds</h2><p>These follow our <a href="/refund-policy">Refund &amp; Cancellation policy</a>.</p>
  <h2>6. Conduct</h2><p>Be respectful to mentors and staff. Do not record sessions without everyone's consent, share room links with others, or use sessions for anything unlawful. We may end a session or account for abusive behaviour, and refund any unused sessions in that case.</p>
  <h2>7. Mentors</h2><p>Mentors are screened by QIVA before onboarding. Their views in a session are their own guidance. Notes and materials shared with you are for your personal use.</p>
  <h2>8. Liability</h2><p>We take reasonable care in arranging sessions. To the extent the law allows, our total liability for any booking is limited to the amount you paid for it. Nothing in these terms limits rights you have under the Consumer Protection Act, 2019.</p>
  <h2>9. Grievances</h2><p>Write to our Grievance Officer using the <a href="/contact#grievance">complaint form</a> or the details below. We acknowledge complaints within 48 hours and aim to resolve them within one month.</p>${grievanceBlock()}
  <h2>10. Law and changes</h2><p>These terms are governed by the laws of India, and the courts at Dehradun, Uttarakhand have jurisdiction. We may update these terms; the version on this page applies to bookings made after it is posted.</p>
  <h2>Contact</h2>${contactBlock()}` });

const privacy = (req) => legal(req, { title: "Privacy Policy", slug: "privacy",
  intro: "What personal data we collect, why, who we share it with, and the rights you have under the Digital Personal Data Protection Act, 2023.",
  html: `<h2>1. Who is responsible</h2><p>${esc(cfg.company.legalName)} is the Data Fiduciary for personal data collected through this website. Contact us at ${esc(cfg.supportEmail)} or through the <a href="/contact">contact page</a>.</p>
  <h2>2. What we collect</h2><ul><li><strong>Account and booking details:</strong> name, mobile number, email, who you are (for example, Class 11 or 12 student), your track, topic and notes, preferred slots.</li><li><strong>Parent or guardian details</strong> for learners under 18: name, mobile number, optional email, and their consent.</li><li><strong>Payment details:</strong> the amount and the UPI reference (UTR) you enter, or the order status returned by our payment gateway. We never see or store card numbers, UPI PINs or bank passwords.</li><li><strong>Mentor applications:</strong> name, contact details, city, role, experience, links and availability.</li><li><strong>Messages and complaints</strong> you send us, and basic technical logs (such as when a record was created or changed).</li></ul>
  <h2>3. Why we use it</h2><p>We process this data with your consent, only to arrange and deliver your mentorship: matching you with a mentor, confirming slots, sending room links, notes and receipts, verifying payments, handling refunds and complaints, keeping our books as the law requires, and reviewing mentor applications. We do not sell personal data and do not use it for advertising.</p>
  <h2>4. Children's data</h2><p>For learners under 18 we process personal data only with the verifiable consent of a parent or lawful guardian. We confirm the guardian's identity and contact details before the first session. We do not track children's behaviour or show them targeted advertising.</p>
  <h2>5. Who we share it with</h2><ul><li>The mentor assigned to your booking.</li><li>Service providers who process data on our behalf: website hosting and database (Render and our database provider), transactional email (Resend), and, when online payment is used, our payment gateway (Cashfree Payments). They may only use the data to provide their service to us.</li><li>Authorities, when the law requires it.</li></ul>
  <h2>6. How long we keep it</h2><p>We keep booking and payment records for as long as tax and accounting laws require, and processing logs for at least one year. Other data is deleted or anonymised when it is no longer needed, or when you ask us to delete it, unless the law requires us to keep it.</p>
  <h2>7. Security</h2><p>Passwords are stored only as salted hashes, the site runs over HTTPS, and only authorised staff can open the admin panel. If a personal data breach occurs, we inform affected people and the Data Protection Board of India as the law requires.</p>
  <h2>8. Your rights</h2><p>You can ask for a summary of your data, correct or update it, ask us to delete it, withdraw your consent, and nominate someone to exercise your rights. Signed-in users can send these requests from <a href="/account">My account</a>; anyone can use the <a href="/contact">contact page</a>. We respond within 90 days, and usually much sooner. Withdrawing consent does not affect processing done before you withdrew it.</p>
  <h2>9. Complaints</h2><p>Contact our Grievance Officer first. If you are not satisfied, you may complain to the Data Protection Board of India.</p>${grievanceBlock()}
  <h2>10. Cookies and browser storage</h2><p>We use one essential cookie to keep you signed in. The "My requests" list on the home page is stored only in your own browser. We do not use advertising or tracking cookies.</p>` });

const refund = (req) => legal(req, { title: "Refund & Cancellation", slug: "refund-policy",
  intro: "How cancelling, rescheduling and refunds work for single sessions and monthly plans.",
  html: `<h2>Single sessions</h2><ul><li>Cancel or reschedule up to 24 hours before the session for a full refund.</li><li>Between 24 and 4 hours before the session, you get 50% back.</li><li>Less than 4 hours before the session, or a missed session, is not refunded.</li></ul>
  <h2>If we cancel</h2><p>If we or your mentor cancel, you choose a new slot or a 100% refund.</p>
  <h2>Your first session</h2><p>If your first session was not useful, tell us within 24 hours. We will offer a different mentor or a refund.</p>
  <h2>Monthly plans</h2><ul><li>Cancel any time to stop the next month.</li><li>Full refund within 7 days of payment if no session has been used.</li><li>Pragati includes one free reschedule a month, and Shikhar one every week.</li></ul>
  <h2>Payment problems</h2><p>If money left your account but your booking is not confirmed within 4 hours during support hours, message us with the booking ID and UPI reference. If we cannot match the payment, we refund it in full.</p>
  <h2>How refunds are paid</h2><p>Refunds go back to the account or UPI ID you paid from within 5 to 7 working days of approval. To ask for a change, cancellation or refund, contact ${esc(cfg.supportPhone)} or ${esc(cfg.supportEmail)}, or use the <a href="/contact">contact page</a>.</p>` });

const delivery = (req) => legal(req, { title: "Service Delivery", slug: "service-delivery",
  intro: "QIVA sells online mentorship sessions. Nothing is shipped; this page explains how sessions are delivered.",
  html: `<h2>How sessions are delivered</h2><ul><li>After payment, we confirm one of your preferred slots on WhatsApp or email, usually within 2 to 4 hours during support hours (${esc(cfg.supportHours)}).</li><li>Each booking gets its own private video room link, sent with the confirmation and shown on your booking page.</li><li>Sessions happen online at the confirmed time in Indian Standard Time. 30 and 60 minute sessions are voice calls; 90 minute sessions are video calls with screen sharing.</li><li>Written notes and action points are sent by email after the session.</li><li>Monthly plans deliver four sessions within 30 days of the first session.</li></ul>
  <h2>No physical shipping</h2><p>We do not ship physical goods. Certificates mentioned in plan bonuses are sent as PDF files by email.</p>
  <h2>If something goes wrong</h2><p>If the mentor does not join within 10 minutes, or the room does not work, message us on WhatsApp at ${esc(cfg.whatsappDisplay)}. We will reschedule at no cost or refund you as described in our <a href="/refund-policy">Refund &amp; Cancellation policy</a>.</p>` });

/* ---------- contact and grievances ---------- */
function contact(req) {
  return layout(req, { title: "Contact & Grievances", path: "/contact", active: "contact", description: "Contact QIVA Mentorship, raise a complaint with our Grievance Officer, or ask a question about a booking.", scripts: ["/contact.js"],
    body: `<section class="page-head"><span class="eyebrow">Contact</span><h1>Talk to QIVA</h1><p class="lede">Questions about a booking, a plan, or becoming a mentor. Every message gets a ticket number so you can follow it up.</p></section>
    <div class="contact">
      <div class="cinfo">
        <div class="row">${ico('<path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.6A8 8 0 1 1 21 12z"/>', 22)}<div><strong>Bookings on WhatsApp</strong><div class="copyrow"><span class="mono">${esc(cfg.whatsappDisplay)}</span><button class="btn btn-sm" type="button" data-copy="${esc(cfg.whatsappDisplay)}">Copy</button></div><span class="muted small">${esc(cfg.supportHours)}</span></div></div>
        <div class="row">${ico('<path d="M4 4h16v16H4z"/><path d="M4 7l8 6 8-6"/>', 22)}<div><strong>Changes and cancellations</strong><span class="mono">${esc(cfg.supportPhone)}</span><br><span class="mono">${esc(cfg.supportEmail)}</span></div></div>
        <div class="row">${ico('<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 22)}<div><strong>Registered office</strong><span>${esc(cfg.company.legalName)}, ${esc(cfg.company.address)}</span></div></div>
        <div class="row" id="grievance">${ico('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/>', 22)}<div><strong>${esc(cfg.grievance.designation)}${cfg.grievance.name ? ": " + esc(cfg.grievance.name) : ""}</strong><span>${esc(cfg.grievance.email)} · ${esc(cfg.grievance.phone)}</span><span class="muted small">We acknowledge complaints within 48 hours and aim to resolve them within one month, under the Consumer Protection (E-Commerce) Rules, 2020.</span></div></div>
      </div>
      <form class="form" id="contactPageForm" novalidate>
        <div class="seg" id="kindSeg" role="group" aria-label="Message type"><span class="knob"></span><button type="button" data-kind="enquiry" aria-pressed="true">Question</button><button type="button" data-kind="grievance" aria-pressed="false">Complaint</button></div>
        <div class="two"><div class="field"><label for="mName">Your name</label><input class="input" id="mName" autocomplete="name" required></div>
        <div class="field"><label for="mPhone">Mobile number</label><input class="input" id="mPhone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10-digit number"></div></div>
        <div class="two"><div class="field"><label for="mEmail">Email</label><input class="input" id="mEmail" type="email" autocomplete="email"></div>
        <div class="field"><label for="mBooking">Booking ID <span class="muted">(optional)</span></label><input class="input mono" id="mBooking" placeholder="QV-XXXXXX"></div></div>
        <div class="field"><label for="mSubject">Subject</label><input class="input" id="mSubject" maxlength="140"></div>
        <div class="field"><label for="mBody">Message</label><textarea class="input" id="mBody" required placeholder="Tell us what happened and what you would like us to do."></textarea></div>
        <span class="err" id="mErr" role="alert"></span>
        <button class="btn btn-dark" type="submit" id="mSend">Send message</button>
        <div id="mDone" hidden class="done-box"></div>
        <span class="muted small">Prefer WhatsApp? <a id="mWa" href="#" target="_blank" rel="noopener">Message us on WhatsApp</a>.</span>
      </form>
    </div>` });
}

/* ---------- become a mentor ---------- */
function mentor(req) {
  const tracks = C.TRACKS.map((t) => `<label class="tcheck"><input type="checkbox" name="tracks" value="${t.id}"><span>${ico(t.icon, 20)}${esc(t.name)}</span></label>`).join("");
  return layout(req, { title: "Become a mentor", path: "/mentor", active: "mentor", description: "Mentor students and young professionals one to one, from home, at hours you choose. Apply to become a QIVA mentor.", scripts: ["/mentor.js"],
    body: `<div class="hero hero-sm"><div class="hero-shell one"><div class="hero-copy">
      <span class="eyebrow">Now inviting mentors</span><h1>Become a <em>QIVA mentor.</em></h1>
      <p class="lede">Share what you know. Guide one learner, one topic at a time, from home, at hours you choose.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><a class="btn btn-dark" href="#apply">Apply now</a><a class="btn" id="mentorWa" href="#" target="_blank" rel="noopener">Ask on WhatsApp</a></div></div></div></div>
    <section><div class="sec-head"><div><span class="eyebrow">Why mentor with QIVA</span><h2>Mentoring that fits your life</h2></div></div>
      <div class="benefits">
        <div class="benefit"><span class="ic">${ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 22)}</span><h3>Your hours, your call</h3><p>Choose your slots, your cadence and how many learners you take on.</p></div>
        <div class="benefit"><span class="ic">${ico('<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>', 22)}</span><h3>Mentor from anywhere</h3><p>Every session runs in its own private video room. Voice or video, no travel.</p></div>
        <div class="benefit"><span class="ic">${ico('<path d="M6 4h12M6 9h12M6 14h3a5 5 0 0 0 0-10M9 14l6 7"/>', 22)}</span><h3>Paid for your time</h3><p>Earn on the single sessions and monthly plans you take. We share payout terms on your intro call.</p></div>
        <div class="benefit"><span class="ic">${ico('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>', 22)}</span><h3>We handle the busywork</h3><p>Bookings, payments and confirmations run through QIVA. You show up and mentor.</p></div>
        <div class="benefit"><span class="ic">${ico('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>', 22)}</span><h3>Impact you can see</h3><p>Learners arrive with a clear goal and leave with written next steps.</p></div>
        <div class="benefit"><span class="ic">${ico('<path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/>', 22)}</span><h3>Safe by design</h3><p>One-to-one private rooms, guardian consent for learners under 18, and a clear code of conduct.</p></div>
      </div></section>
    <section style="padding-top:0"><div class="panel"><div class="sec-head"><div><span class="eyebrow">How joining works</span><h2>From hello to your first session</h2></div></div>
      <ol class="steps steps-4"><li><span class="n">1</span><h3>Apply</h3><p>Tell us your field, experience and the hours you can give.</p></li><li><span class="n">2</span><h3>Intro call</h3><p>A short call to understand your strengths, check your identity and agree on terms.</p></li><li><span class="n">3</span><h3>Set your slots</h3><p>Share your focus areas and your times in IST.</p></li><li><span class="n">4</span><h3>Start mentoring</h3><p>Learners book you; you meet in the private room and send notes after each session.</p></li></ol></div></section>
    <section id="apply"><div class="sec-head"><div><span class="eyebrow">Application</span><h2>Apply to mentor</h2><p>It takes about three minutes. We reply within a few working days.</p></div></div>
      <form class="form form-wide" id="mentorForm" novalidate>
        <div class="two"><div class="field"><label for="aName">Full name</label><input class="input" id="aName" autocomplete="name" required></div><div class="field"><label for="aCity">City</label><input class="input" id="aCity" autocomplete="address-level2" required></div></div>
        <div class="two"><div class="field"><label for="aEmail">Email</label><input class="input" id="aEmail" type="email" autocomplete="email" required></div><div class="field"><label for="aPhone">Mobile (WhatsApp)</label><input class="input" id="aPhone" type="tel" inputmode="numeric" autocomplete="tel" required placeholder="10-digit number"></div></div>
        <div class="field"><span class="lbl">Tracks you can mentor</span><div class="tgrid">${tracks}</div></div>
        <div class="two"><div class="field"><label for="aRole">Current role</label><input class="input" id="aRole" placeholder="For example, Software engineer at a product company" required></div><div class="field"><label for="aYears">Years of experience</label><input class="input" id="aYears" type="number" min="0" max="60" inputmode="numeric" required></div></div>
        <div class="two"><div class="field"><label for="aHours">Hours you can give each month</label><input class="input" id="aHours" type="number" min="1" max="200" inputmode="numeric" required></div><div class="field"><label for="aLang">Languages</label><input class="input" id="aLang" placeholder="For example, English, Hindi"></div></div>
        <div class="field"><label for="aLink">LinkedIn or portfolio link <span class="muted">(optional)</span></label><input class="input" id="aLink" type="url" placeholder="https://"></div>
        <div class="field"><label for="aWhy">Why do you want to mentor?</label><textarea class="input" id="aWhy" required placeholder="A few lines about what you would like to help learners with."></textarea></div>
        <label class="check"><input type="checkbox" id="aConsent"><span>I agree that QIVA may contact me about this application and keep my details as described in the <a href="/privacy">Privacy Policy</a>.</span></label>
        <span class="err" id="aErr" role="alert"></span>
        <button class="btn btn-dark" type="submit" id="aSend">Send application</button>
        <div id="aDone" hidden class="done-box"></div>
      </form></section>` });
}

/* ---------- app shells ---------- */
const account = (req) => layout(req, { title: "My account", path: "/account", noindex: true, scripts: ["/account.js"], body: `<section class="page-head"><span class="eyebrow">My account</span><h1 id="accTitle">Sign in</h1></section><div id="accRoot" class="acc"><p class="muted">Loading…</p></div>` });
const reset = (req) => layout(req, { title: "Choose a new password", path: "/reset-password", noindex: true, scripts: ["/account.js"], body: `<section class="page-head"><span class="eyebrow">My account</span><h1>Choose a new password</h1></section><div id="accRoot" class="acc" data-mode="reset"></div>` });
const booking = (req) => layout(req, { title: "Your booking", path: "/booking", noindex: true, scripts: [...(cfg.cashfree.enabled ? ["https://sdk.cashfree.com/js/v3/cashfree.js"] : []), "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js", "/booking.js"], body: `<section class="page-head"><span class="eyebrow">Booking</span><h1 id="bTitle">Your booking</h1></section><div id="bRoot" class="acc"><p class="muted">Loading your booking…</p></div>` });
const admin = (req) => layout(req, { title: "Admin", path: "/admin", noindex: true, scripts: ["/admin.js"], body: `<div id="adminRoot" class="admin"><p class="muted">Loading the admin panel…</p></div>` });
const notFound = (req) => layout(req, { title: "Page not found", path: req.path, noindex: true, body: `<section class="page-head"><span class="eyebrow">404</span><h1>That page is not here</h1><p class="lede">The link may be old or mistyped.</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:18px"><a class="btn btn-dark" href="/">Go to the home page</a><a class="btn" href="/contact">Contact us</a></div></section>` });

module.exports = { home, terms, privacy, refund, delivery, contact, mentor, account, reset, booking, admin, notFound };
