import express from "express";
import crypto from "crypto";
import { db } from "./db.js";
import { authenticate, requireCsrf } from "./middleware.js";

export const businessRouter = express.Router();
businessRouter.use(authenticate);

const DATA_KEYS = new Set(["jobs", "clients", "employees", "files", "payroll", "users", "payrollSettings"]);
const PAGE_PERMISSIONS = ["dashboard", "jobs", "new-request", "payroll", "invoices", "users", "files", "clients"];

function toBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    ownerEmail: row.owner_email,
    settings: JSON.parse(row.settings_json),
  };
}

function getOwnedBusiness(businessId, ownerEmail) {
  return db.prepare("SELECT * FROM businesses WHERE id = ? AND owner_email = ?").get(businessId, ownerEmail);
}

function defaultAdminUser(req) {
  return [
    {
      id: req.userId,
      name: req.userName || "Account Admin",
      email: req.userEmail,
      role: "Admin",
      permissions: PAGE_PERMISSIONS,
    },
  ];
}

function defaultDataForKey(key, req) {
  if (key === "users") return defaultAdminUser(req);
  if (key === "payrollSettings") {
    return { defaultHourlyRate: 25, defaultCommissionRate: 10, defaultFlatFee: 1500, taxWithholdingRate: 12 };
  }
  return [];
}

function cleanString(value, fallback = "", max = 500) {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

function sanitizeSettings(currentSettings, payload) {
  const allowed = new Set([
    "name",
    "address",
    "email",
    "phone",
    "logoUrl",
    "paymentTerms",
    "currency",
    "taxRate",
    "notificationNewJobAlert",
    "notificationStatusChangeAlert",
  ]);
  const unknown = Object.keys(payload || {}).filter((key) => !allowed.has(key));
  if (unknown.length) {
    const err = new Error(`Unsupported settings field: ${unknown[0]}`);
    err.status = 400;
    throw err;
  }

  const next = { ...currentSettings };
  if ("name" in payload) next.name = cleanString(payload.name, currentSettings.name, 120);
  if ("address" in payload) next.address = cleanString(payload.address, currentSettings.address, 500);
  if ("email" in payload) next.email = cleanString(payload.email, currentSettings.email, 254);
  if ("phone" in payload) next.phone = cleanString(payload.phone, currentSettings.phone, 40);
  if ("logoUrl" in payload) next.logoUrl = cleanString(payload.logoUrl, currentSettings.logoUrl, 1000);
  if ("paymentTerms" in payload) next.paymentTerms = cleanString(payload.paymentTerms, currentSettings.paymentTerms, 1000);
  if ("currency" in payload) {
    const currency = cleanString(payload.currency, currentSettings.currency, 3).toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      const err = new Error("Currency must be a 3-letter ISO currency code.");
      err.status = 400;
      throw err;
    }
    next.currency = currency;
  }
  if ("taxRate" in payload) {
    const taxRate = Number(payload.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
      const err = new Error("Tax rate must be a number between 0 and 100.");
      err.status = 400;
      throw err;
    }
    next.taxRate = taxRate;
  }
  if ("notificationNewJobAlert" in payload) next.notificationNewJobAlert = Boolean(payload.notificationNewJobAlert);
  if ("notificationStatusChangeAlert" in payload) {
    next.notificationStatusChangeAlert = Boolean(payload.notificationStatusChangeAlert);
  }

  if (!next.name?.trim()) {
    const err = new Error("Business name is required.");
    err.status = 400;
    throw err;
  }
  return next;
}

businessRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM businesses WHERE owner_email = ?").all(req.userEmail);
  res.json({ businesses: rows.map(toBusiness) });
});

businessRouter.post("/", requireCsrf, (req, res) => {
  const { name, email, phone, address } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: "Business name is required." });
  }

  const existingCount = db
    .prepare("SELECT COUNT(*) as count FROM businesses WHERE owner_email = ?")
    .get(req.userEmail).count;

  if (existingCount >= 1) {
    return res.status(403).json({
      error: "Subscription limit reached: your plan allows registering exactly 1 business division.",
    });
  }

  const id = `biz_${crypto.randomUUID().slice(0, 8)}`;
  const settings = sanitizeSettings(
    {
      name: name.trim(),
      address: "Not configured",
      email: req.userEmail,
      phone: "+1 (555) 000-0000",
      logoUrl: "",
      paymentTerms: "Due within 30 days.",
      currency: "USD",
      taxRate: 0,
      notificationNewJobAlert: true,
      notificationStatusChangeAlert: true,
    },
    { name, email, phone, address }
  );

  const insert = db.transaction(() => {
    db.prepare("INSERT INTO businesses (id, name, owner_email, settings_json) VALUES (?, ?, ?, ?)").run(
      id,
      settings.name,
      req.userEmail,
      JSON.stringify(settings)
    );
    db.prepare("INSERT INTO business_members (business_id, user_id, role, permissions_json) VALUES (?, ?, 'Admin', ?)").run(
      id,
      req.userId,
      JSON.stringify(PAGE_PERMISSIONS)
    );
    db.prepare("INSERT INTO business_data (business_id, data_key, data_json) VALUES (?, 'users', ?)").run(
      id,
      JSON.stringify(defaultAdminUser(req))
    );
  });
  insert();

  const row = db.prepare("SELECT * FROM businesses WHERE id = ?").get(id);
  res.status(201).json({ business: toBusiness(row) });
});

businessRouter.get("/:id/data/:key", (req, res) => {
  if (!DATA_KEYS.has(req.params.key)) {
    return res.status(404).json({ error: "Unsupported business data key." });
  }
  if (!getOwnedBusiness(req.params.id, req.userEmail)) {
    return res.status(404).json({ error: "Business not found." });
  }
  const row = db
    .prepare("SELECT data_json FROM business_data WHERE business_id = ? AND data_key = ?")
    .get(req.params.id, req.params.key);
  res.json({ data: row ? JSON.parse(row.data_json) : defaultDataForKey(req.params.key, req) });
});

businessRouter.put("/:id/data/:key", requireCsrf, (req, res) => {
  if (!DATA_KEYS.has(req.params.key)) {
    return res.status(404).json({ error: "Unsupported business data key." });
  }
  if (!getOwnedBusiness(req.params.id, req.userEmail)) {
    return res.status(404).json({ error: "Business not found." });
  }
  const data = req.body?.data;
  if (data === undefined || data === null || typeof data !== "object") {
    return res.status(400).json({ error: "Business data payload must be an array or object." });
  }
  db.prepare(
    `INSERT INTO business_data (business_id, data_key, data_json, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(business_id, data_key) DO UPDATE SET data_json = excluded.data_json, updated_at = datetime('now')`
  ).run(req.params.id, req.params.key, JSON.stringify(data));
  res.json({ ok: true });
});

businessRouter.put("/:id/settings", requireCsrf, (req, res) => {
  const row = getOwnedBusiness(req.params.id, req.userEmail);
  if (!row) {
    return res.status(404).json({ error: "Business not found." });
  }
  try {
    const newSettings = sanitizeSettings(JSON.parse(row.settings_json), req.body || {});
    db.prepare("UPDATE businesses SET settings_json = ?, name = ? WHERE id = ?").run(
      JSON.stringify(newSettings),
      newSettings.name,
      row.id
    );
    const updated = db.prepare("SELECT * FROM businesses WHERE id = ?").get(row.id);
    res.json({ business: toBusiness(updated) });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || "Invalid settings payload." });
  }
});
