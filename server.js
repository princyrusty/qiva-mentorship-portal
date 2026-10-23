"use strict";
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const cfg = require("./src/config");
const db = require("./src/db");
const auth = require("./src/auth");
const api = require("./src/api");
const adminRouter = require("./src/admin");
const pages = require("./src/pages");
const { baseUrl } = require("./src/util");

function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://cdnjs.cloudflare.com", "https://sdk.cashfree.com"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", "https://*.cashfree.com"],
        "frame-src": ["https://*.cashfree.com"],
        "form-action": ["'self'", "https://*.cashfree.com"],
        "upgrade-insecure-requests": cfg.isProd ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    strictTransportSecurity: cfg.isProd ? { maxAge: 15552000, includeSubDomains: true } : false
  }));
  app.use(compression());
  app.use(cookieParser());

  app.get("/healthz", async (req, res) => {
    try { await db.query("SELECT 1"); res.json({ ok: true, db: db.kind() }); }
    catch (e) { res.status(503).json({ ok: false }); }
  });

  // Cashfree needs the untouched body to verify its signature, so this route sits before the JSON parser.
  app.post("/api/webhooks/cashfree", express.raw({ type: "*/*", limit: "1mb" }), (req, res, next) => api.cashfreeWebhook(req, res).catch(next));

  app.use(express.json({ limit: "100kb" }));
  app.use(auth.loadUser());

  // Block cross-site writes: state-changing API calls must be same-origin JSON.
  app.use("/api", (req, res, next) => {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const origin = req.get("origin");
    if (origin) {
      let host = "";
      try { host = new URL(origin).host; } catch (e) { /* malformed origin */ }
      if (host !== req.get("host")) return res.status(403).json({ error: "Cross-site request blocked." });
    }
    if (!req.is("application/json")) return res.status(415).json({ error: "Send the request as JSON." });
    next();
  });
  app.use("/api", (req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

  app.use("/api/admin", adminRouter);
  app.use("/api", api.router);
  app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

  const page = (fn) => (req, res) => res.set("Cache-Control", "no-cache").type("html").send(fn(req));
  app.get("/", page(pages.home));
  app.get("/mentor", page(pages.mentor));
  app.get("/contact", page(pages.contact));
  app.get("/grievance", (req, res) => res.redirect(301, "/contact#grievance"));
  app.get("/terms", page(pages.terms));
  app.get("/privacy", page(pages.privacy));
  app.get("/refund-policy", page(pages.refund));
  app.get("/service-delivery", page(pages.delivery));
  app.get(["/shipping-policy", "/delivery-policy"], (req, res) => res.redirect(301, "/service-delivery"));
  app.get("/account", page(pages.account));
  app.get("/reset-password", page(pages.reset));
  app.get("/booking/:id", page(pages.booking));
  app.get("/admin", page(pages.admin));

  app.get("/robots.txt", (req, res) => res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /booking/\nDisallow: /api/\nSitemap: ${baseUrl(cfg, req)}/sitemap.xml\n`));
  app.get("/sitemap.xml", (req, res) => {
    const base = baseUrl(cfg, req);
    const urls = ["/", "/mentor", "/contact", "/terms", "/privacy", "/refund-policy", "/service-delivery"];
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join("")}</urlset>\n`);
  });

  app.use(express.static(path.join(__dirname, "public"), { maxAge: cfg.isProd ? "7d" : 0, index: false }));

  app.use((req, res) => res.status(404).type("html").send(pages.notFound(req)));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error("[error]", req.method, req.path, err && err.stack ? err.stack : err);
    if (res.headersSent) return;
    if (req.path.startsWith("/api")) return res.status(500).json({ error: "Something went wrong on our side. Please try again." });
    res.status(500).type("html").send("<h1>Something went wrong</h1><p>Please try again in a minute.</p>");
  });
  return app;
}

async function start() {
  await db.init(cfg);
  const app = createApp();
  return new Promise((resolve) => {
    const server = app.listen(cfg.port, () => {
      console.log(`[qiva] listening on ${cfg.port} (db: ${db.kind()}, cashfree: ${cfg.cashfree.enabled ? cfg.cashfree.env : "off"}, email: ${cfg.email.resendKey ? "on" : "off"})`);
      resolve(server);
    });
    const stop = () => server.close(() => db.end().finally(() => process.exit(0)));
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);
  });
}

// Express 4 does not catch rejected promises from async handlers; this wrapper forwards them to the error handler.
const Layer = require("express/lib/router/layer");
const handle = Layer.prototype.handle_request;
Layer.prototype.handle_request = function (req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return handle.call(this, req, res, next);
  try {
    const r = fn(req, res, next);
    if (r && typeof r.catch === "function") r.catch(next);
  } catch (e) { next(e); }
};

if (require.main === module) start().catch((e) => { console.error("[qiva] failed to start", e); process.exit(1); });

module.exports = { createApp, start };
