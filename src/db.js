"use strict";
// Postgres access. Production uses node-postgres with DATABASE_URL.
// Without DATABASE_URL (local development and tests only) an in-memory PGlite database is used.
const fs = require("fs");
const path = require("path");

let impl = null;

function sslFor(url) {
  try {
    const u = new URL(url);
    // Render's internal database hostnames have no dots and do not use TLS. Anything else (Neon, Supabase,
    // Render's external URL) is reached over the public internet and needs TLS.
    return u.hostname.includes(".") ? { rejectUnauthorized: false } : false;
  } catch (e) {
    return { rejectUnauthorized: false };
  }
}

function stripSslMode(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete("sslmode");
    u.searchParams.delete("channel_binding");
    return u.toString();
  } catch (e) {
    return url;
  }
}

async function init(cfg) {
  if (cfg.databaseUrl) {
    const { Pool } = require("pg");
    const pool = new Pool({ connectionString: stripSslMode(cfg.databaseUrl), ssl: sslFor(cfg.databaseUrl), max: 5, idleTimeoutMillis: 30000 });
    pool.on("error", (err) => console.error("[db] idle client error", err.message));
    impl = {
      kind: "postgres",
      query: (text, params) => pool.query(text, params),
      exec: (sql) => pool.query(sql),
      end: () => pool.end()
    };
  } else {
    if (cfg.isProd) throw new Error("DATABASE_URL is required when NODE_ENV=production");
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite();
    await db.waitReady;
    impl = {
      kind: "pglite",
      query: (text, params) => db.query(text, params),
      exec: (sql) => db.exec(sql),
      end: () => db.close()
    };
    console.warn("[db] DATABASE_URL not set: using a temporary in-memory database (development only).");
  }
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await impl.exec(schema);
  return impl;
}

module.exports = {
  init,
  query: (text, params) => impl.query(text, params),
  one: async (text, params) => (await impl.query(text, params)).rows[0] || null,
  many: async (text, params) => (await impl.query(text, params)).rows,
  kind: () => (impl ? impl.kind : "none"),
  end: () => (impl ? impl.end() : Promise.resolve())
};
