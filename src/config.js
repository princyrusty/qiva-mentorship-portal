"use strict";
// All runtime settings come from environment variables. See .env.example for the full list.
const env = process.env;

const cashfree = {
  appId: env.CASHFREE_APP_ID || "",
  secret: env.CASHFREE_SECRET_KEY || "",
  env: env.CASHFREE_ENV === "production" ? "production" : "sandbox",
  apiVersion: env.CASHFREE_API_VERSION || "2025-01-01"
};
cashfree.enabled = Boolean(cashfree.appId && cashfree.secret);

module.exports = {
  port: Number(env.PORT) || 3000,
  isProd: env.NODE_ENV === "production",
  siteUrl: (env.SITE_URL || env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, ""),
  databaseUrl: env.DATABASE_URL || "",
  setupCode: env.ADMIN_SETUP_CODE || "",

  upiId: env.UPI_ID || "9084687772@ptsbi",
  upiPayee: env.UPI_PAYEE_NAME || "QIVA Mentorship",
  whatsapp: (env.WHATSAPP_NUMBER || "919997030409").replace(/\D/g, ""),
  whatsappDisplay: env.WHATSAPP_DISPLAY || "+91 99970 30409",
  supportPhone: env.SUPPORT_PHONE || "+91 90846 87772",
  supportEmail: env.SUPPORT_EMAIL || "aithemeroom@gmail.com",
  supportHours: env.SUPPORT_HOURS || "Monday to Saturday, 10 AM to 8 PM IST",
  adminNotifyEmail: env.ADMIN_NOTIFY_EMAIL || env.SUPPORT_EMAIL || "aithemeroom@gmail.com",

  company: {
    brand: "QIVA Mentorship",
    legalName: env.COMPANY_LEGAL_NAME || "QIVA Connect Private Limited",
    address: env.COMPANY_ADDRESS || "Tower B, Flat 106, Jalvayu Towers, Kahagra, Dehradun, Uttarakhand, India",
    city: "Dehradun",
    gstin: env.GSTIN || "",
    cin: env.CIN || ""
  },
  grievance: {
    name: env.GRIEVANCE_OFFICER_NAME || "",
    designation: env.GRIEVANCE_OFFICER_DESIGNATION || "Grievance Officer",
    email: env.GRIEVANCE_OFFICER_EMAIL || env.SUPPORT_EMAIL || "aithemeroom@gmail.com",
    phone: env.GRIEVANCE_OFFICER_PHONE || env.SUPPORT_PHONE || "+91 90846 87772"
  },

  email: {
    resendKey: env.RESEND_API_KEY || "",
    from: env.EMAIL_FROM || "QIVA Mentorship <onboarding@resend.dev>",
    replyTo: env.EMAIL_REPLY_TO || env.SUPPORT_EMAIL || "aithemeroom@gmail.com"
  },
  cashfree,
  sessionDays: 30
};
