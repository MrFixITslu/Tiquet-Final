import express from "express";
import crypto from "crypto";
import { db } from "./db.js";
import { authenticate } from "./middleware.js";

export const businessRouter = express.Router();
businessRouter.use(authenticate);

function toBusiness(row) {
  return {
    id: row.id,
    name: row.name,
    ownerEmail: row.owner_email,
    settings: JSON.parse(row.settings_json),
  };
}

// List businesses owned by the logged-in user.
businessRouter.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM businesses WHERE owner_email = ?").all(req.userEmail);
  res.json({ businesses: rows.map(toBusiness) });
});

// Create a business division. The "1 business per subscription" limit is
// now enforced here, server-side - previously it only lived in the React
// state, so anyone could bypass it by editing localStorage.
businessRouter.post("/", (req, res) => {
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
  const settings = {
    name: name.trim(),
    address: address?.trim() || "Not configured",
    email: email?.trim() || req.userEmail,
    phone: phone?.trim() || "+1 (555) 000-0000",
    logoUrl: "",
    paymentTerms: "Due within 30 days.",
    currency: "USD",
    taxRate: 0,
    notificationNewJobAlert: true,
    notificationStatusChangeAlert: true,
  };

  db.prepare(
    "INSERT INTO businesses (id, name, owner_email, settings_json) VALUES (?, ?, ?, ?)"
  ).run(id, name.trim(), req.userEmail, JSON.stringify(settings));

  const row = db.prepare("SELECT * FROM businesses WHERE id = ?").get(id);
  res.status(201).json({ business: toBusiness(row) });
});

// Update a business's settings (used by the in-app Settings page).
businessRouter.put("/:id/settings", (req, res) => {
  const row = db.prepare("SELECT * FROM businesses WHERE id = ? AND owner_email = ?").get(
    req.params.id,
    req.userEmail
  );
  if (!row) {
    return res.status(404).json({ error: "Business not found." });
  }
  const newSettings = { ...JSON.parse(row.settings_json), ...(req.body || {}) };
  db.prepare("UPDATE businesses SET settings_json = ?, name = ? WHERE id = ?").run(
    JSON.stringify(newSettings),
    newSettings.name || row.name,
    row.id
  );
  const updated = db.prepare("SELECT * FROM businesses WHERE id = ?").get(row.id);
  res.json({ business: toBusiness(updated) });
});
