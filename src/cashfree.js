"use strict";
// Cashfree Payment Gateway (PG) client: create orders, fetch order status, verify webhook signatures.
// Docs: Create Order POST /pg/orders, Get Order GET /pg/orders/{order_id}, webhook signature =
// base64(HMAC-SHA256(secret, timestamp + rawBody)) compared with the x-webhook-signature header.
const crypto = require("crypto");
const cfg = require("./config");

const base = () => (cfg.cashfree.env === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg");
const headers = () => ({
  "Content-Type": "application/json",
  "x-api-version": cfg.cashfree.apiVersion,
  "x-client-id": cfg.cashfree.appId,
  "x-client-secret": cfg.cashfree.secret
});

async function call(method, path, body) {
  const r = await fetch(base() + path, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
  if (!r.ok) {
    const err = new Error((data && data.message) || `Cashfree ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data;
}

function createOrder({ orderId, amount, customer, returnUrl, notifyUrl, note }) {
  return call("POST", "/orders", {
    order_id: orderId,
    order_amount: Number(amount),
    order_currency: "INR",
    customer_details: {
      customer_id: customer.id,
      customer_phone: customer.phone,
      customer_name: customer.name,
      customer_email: customer.email || undefined
    },
    order_meta: { return_url: returnUrl, notify_url: notifyUrl },
    order_note: note
  });
}

const getOrder = (orderId) => call("GET", "/orders/" + encodeURIComponent(orderId));

function verifyWebhook(rawBody, timestamp, signature) {
  if (!rawBody || !timestamp || !signature) return false;
  const expected = crypto.createHmac("sha256", cfg.cashfree.secret).update(String(timestamp) + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createOrder, getOrder, verifyWebhook, enabled: () => cfg.cashfree.enabled, mode: () => cfg.cashfree.env };
