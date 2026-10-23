# QIVA Mentorship Portal

One-to-one mentorship booking for students and early professionals in India: tracks, plans, booking with UPI (and Cashfree when activated), student accounts, mentor applications, a complaints desk, and an owner dashboard.

Node 22 · Express · PostgreSQL · no front-end build step.

## What is in it

| Area | What it does |
| --- | --- |
| Home (`/`) | Tracks explorer, plans and a plan-vs-single calculator, FAQ, a four-step booking window |
| Booking | Pick a plan or session, a track, two preferred slots (IST), learner details. Pay by UPI QR or UPI ID and enter the 12-digit UTR. With Cashfree keys set, card, netbanking and UPI checkout appears too |
| Booking page (`/booking/QV-XXXXXX?t=…`) | Private status page: payment, confirmed slot, room link. Works without an account |
| Student accounts (`/account`) | Sign up, sign in, password reset by email, bookings list, data-rights requests (DPDP Act) |
| Under-18 learners | Parent or guardian name, phone and consent are collected at booking. The owner must confirm with the guardian before the session can be confirmed |
| Mentors (`/mentor`) | Application form with tracks, experience and availability |
| Contact (`/contact`) | Questions and formal complaints. Every message gets a `QT-` ticket number |
| Admin (`/admin`) | Verify UPI payments, confirm slots (a private Jitsi room is generated, or paste a Google Meet link), cancel, refund, review applications and messages, export CSV |
| Policies | Terms, Privacy (DPDP Act 2023 and Rules 2025), Refund and Cancellation, Service Delivery, Grievance Officer in the footer (Consumer Protection (E-Commerce) Rules 2020) |
| Email | Booking received, confirmed, cancelled, application received, ticket acknowledgement, password reset, owner alerts. Sent through Resend; skipped when no key is set |

Security: bcrypt password hashes, HttpOnly SameSite cookies, hashed session tokens, CSP and HSTS through Helmet, rate limits on every form, same-origin JSON checks on every write, prices always taken from the server catalog, signed Cashfree webhooks, CSV formula-injection guard, audit log.

## Deploy on Render (free)

1. Push this repository to GitHub.
2. In Render: **New > Blueprint**, pick the repository, then **Apply**. `render.yaml` creates:
   - `qiva-mentorship`: a free web service in Singapore
   - `qiva-db`: a free PostgreSQL database, connected through `DATABASE_URL`
   - `ADMIN_SETUP_CODE`: a random one-time code
3. When the deploy is live, open the service's **Environment** tab, reveal `ADMIN_SETUP_CODE`, then go to `https://<your-service>.onrender.com/admin` and create the owner account with it.

### Things to know about the free tier

- **The web service sleeps after 15 minutes without visitors.** The next visit takes up to about a minute to wake it. Upgrade the service to Starter when you start taking real bookings.
- **Render's free PostgreSQL database expires 30 days after it is created**, and is deleted if not upgraded. Before then, either upgrade it, or move to a free permanent database:
  1. Create a free project at [neon.tech](https://neon.tech) (region: Singapore).
  2. Copy its connection string.
  3. In Render, open the web service > Environment, replace `DATABASE_URL` with the Neon string, and save. Tables are created on start.
  4. To carry existing data over, export CSVs from `/admin` first, or use `pg_dump` from the Render database to Neon.

## Settings (Environment variables)

Everything has a working default except the items marked **set this**. See `.env.example` for the full list.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Set by the Blueprint |
| `ADMIN_SETUP_CODE` | One-time code for creating the owner account. Set by the Blueprint |
| `GRIEVANCE_OFFICER_NAME` | **Set this.** Name of your Grievance Officer, shown in the footer and on the contact page. Required by the E-Commerce Rules |
| `RESEND_API_KEY` | **Set this** to send emails. Free at [resend.com](https://resend.com) |
| `EMAIL_FROM` | Sender. Keep `onboarding@resend.dev` only for testing (Resend then delivers only to your own Resend address). Verify your domain in Resend and use e.g. `QIVA Mentorship <hello@yourdomain.in>` |
| `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY` | Cashfree Payment Gateway keys. Online payment appears when both are set |
| `CASHFREE_ENV` | `sandbox` for test keys, `production` for live keys |
| `UPI_ID`, `UPI_PAYEE_NAME` | Where UPI payments go. Default `9084687772@ptsbi` |
| `WHATSAPP_NUMBER`, `SUPPORT_PHONE`, `SUPPORT_EMAIL`, `SUPPORT_HOURS` | Contact details shown on the site |
| `COMPANY_LEGAL_NAME`, `COMPANY_ADDRESS`, `GSTIN`, `CIN` | Shown in the footer and policies |
| `SITE_URL` | Only if you add a custom domain, e.g. `https://qiva.in` |

### Turning on Cashfree

1. Finish KYC in the Cashfree Merchant Dashboard and get Payment Gateway activated.
2. Developers > API Keys: copy the App ID and Secret Key into Render (`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`), set `CASHFREE_ENV=production`.
3. Developers > Webhooks: add `https://<your-site>/api/webhooks/cashfree` for payment events.
4. Whitelist your site's domain in Cashfree if asked.

Payments are confirmed three ways: the customer's return to the booking page (the server re-checks the order with Cashfree), the signed webhook, and the owner dashboard.

## Day-to-day use

1. A learner books and pays by UPI, then enters the UTR. You get an email (with Resend) and the booking appears under **Admin > Bookings > Payments to verify**.
2. Check the amount and UTR in your bank or UPI app. Click **Payment verified**.
3. For under-18 learners, call the parent or guardian, then tick the guardian box.
4. Choose the slot and click **Confirm session**. A private `meet.jit.si` room link is created unless you paste a Google Meet link. The learner sees it on their booking page and gets an email.
   - meet.jit.si asks the host to sign in (Google, GitHub or Facebook) before guests can join, so the mentor should open the link first.
5. After the session, **Mark completed**.
6. Answer complaints within 48 hours: open **Messages**, reply, then **Mark acknowledged**. Data requests must be answered within 90 days.

## Run locally

```bash
npm install
npm test                        # end-to-end tests with an in-memory database
ADMIN_SETUP_CODE=local-code npm run dev
# open http://localhost:3000 and http://localhost:3000/admin
```

Without `DATABASE_URL` the app uses a temporary in-memory PostgreSQL (PGlite) that is cleared on restart. It refuses to start that way in production.

## Project layout

```
server.js           Express app: security headers, routes, static files
src/api.js          Public API: config, accounts, bookings, payments, applications, messages
src/admin.js        Owner API: setup, summary, bookings, applications, messages, CSV export
src/pages.js        Server-rendered pages, SEO tags and structured data, policies
src/home.html       Home page body
src/schema.sql      Database tables (created automatically on start)
src/email.js        Email templates (Resend)
src/cashfree.js     Cashfree orders and webhook signature check
public/             CSS, browser scripts, shared catalog (prices, tracks, slots), images
test/e2e.test.js    End-to-end tests
render.yaml         Render Blueprint
```

Prices, plans, tracks and slot times live in `public/catalog.js`, which both the browser and the server read, so a change there updates the site and the price check together.

## Before going fully live

- [ ] Set `GRIEVANCE_OFFICER_NAME`
- [ ] Add `RESEND_API_KEY` and a verified sender domain
- [ ] Move the database to Neon or a paid Render plan within 30 days
- [ ] Have a lawyer review the Terms, Privacy, and Refund policies for your business
- [ ] Add GSTIN and CIN once registered
- [ ] Activate Cashfree when ready
