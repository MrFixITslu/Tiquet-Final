import express from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import { db } from "./db.js";
import { issueSession, clearSession, authenticate, issueCsrfToken, requireCsrf } from "./middleware.js";

export const authRouter = express.Router();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
// A pre-computed dummy hash, used so login always calls bcrypt.compare even
// when no account exists - this keeps response timing (and error copy)
// identical for "no such user" and "wrong password" so an attacker can't
// use the API to enumerate registered emails.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 12);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts from this network. Please try again in 15 minutes." },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many accounts created from this network. Please try again later." },
});

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    provider: row.provider,
    photoUrl: row.photo_url || undefined,
  };
}

function upsertOAuthUser({ provider, providerId, email, name, photoUrl, emailVerified = false }) {
  const normalizedEmail = email.toLowerCase().trim();
  let user = db.prepare("SELECT * FROM users WHERE provider = ? AND provider_id = ?").get(provider, providerId);
  if (!user && emailVerified) {
    user = db.prepare("SELECT * FROM users WHERE email = ? AND provider = 'email'").get(normalizedEmail);
  }
  if (!user) {
    const id = `${provider.slice(0, 1)}_${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(
      `INSERT INTO users (id, name, email, provider, provider_id, photo_url) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, name, normalizedEmail, provider, providerId, photoUrl || null);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  } else if (photoUrl && photoUrl !== user.photo_url) {
    db.prepare("UPDATE users SET photo_url = ? WHERE id = ?").run(photoUrl, user.id);
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  }
  if (user.provider !== provider || user.provider_id !== providerId) {
    db.prepare("UPDATE users SET provider = ?, provider_id = ?, photo_url = COALESCE(?, photo_url) WHERE id = ?").run(
      provider,
      providerId,
      photoUrl || null,
      user.id
    );
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  }
  return user;
}

authRouter.get("/csrf", authenticate, (req, res) => {
  res.json({ csrfToken: issueCsrfToken(res) });
});

authRouter.post("/register", registerLimiter, (req, res) => {
  if (process.env.ALLOW_PUBLIC_REGISTRATION === "false") {
    return res.status(403).json({ error: "Public registration is disabled for this deployment." });
  }
  const { name, email, password } = req.body || {};

  if (!name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "Name, email, and password are required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: "This email is already registered." });
  }

  const id = `usr_${crypto.randomUUID().slice(0, 8)}`;
  const passwordHash = bcrypt.hashSync(password, 12);

  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, provider) VALUES (?, ?, ?, ?, 'email')`
  ).run(id, name.trim(), normalizedEmail, passwordHash);

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  issueSession(res, user);
  res.status(201).json({ user: toPublicUser(user) });
});

authRouter.post("/login", loginLimiter, (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required." });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);

  if (user && user.locked_until && user.locked_until > Date.now()) {
    return res.status(423).json({
      error: "This account is temporarily locked after repeated failed login attempts. Try again in 15 minutes.",
    });
  }

  const hashToCheck = user?.password_hash || DUMMY_HASH;
  const validPassword = bcrypt.compareSync(password, hashToCheck);

  if (!user || !user.password_hash || !validPassword) {
    if (user) {
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;
      db.prepare("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?").run(
        attempts,
        lockedUntil,
        user.id
      );
    }
    return res.status(401).json({ error: "Invalid email or password." });
  }

  db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?").run(user.id);
  issueSession(res, user);
  res.json({ user: toPublicUser(user) });
});

authRouter.post("/logout", authenticate, requireCsrf, (req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get("/me", authenticate, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.userId);
  if (!user) {
    clearSession(res);
    return res.status(401).json({ error: "Not authenticated." });
  }
  res.json({ user: toPublicUser(user) });
});

// Google Sign-In: the client already completed the Firebase/Google popup
// flow and holds a Google OAuth access token. We verify that token directly
// against Google's userinfo endpoint server-side (never trusting a
// client-supplied profile object), then issue our own session.
authRouter.post("/oauth/google", async (req, res) => {
  const { accessToken } = req.body || {};
  if (!accessToken) {
    return res.status(400).json({ error: "Missing Google access token." });
  }
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return res.status(401).json({ error: "Google token verification failed. Please try signing in again." });
    }
    const profile = await response.json();
    if (!profile.email) {
      return res.status(401).json({ error: "Google account has no email on file." });
    }
    const user = upsertOAuthUser({
      provider: "google",
      providerId: profile.sub,
      email: profile.email,
      name: profile.name || "Google User",
      photoUrl: profile.picture,
      emailVerified: profile.email_verified === true,
    });
    issueSession(res, user);
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.status(502).json({ error: "Could not reach Google to verify sign-in. Please try again." });
  }
});

// Facebook Login: verify the access token server-side against the Graph API
// (moved here from the frontend, which was trusting an un-verified client-side call).
authRouter.post("/oauth/facebook", async (req, res) => {
  const { accessToken } = req.body || {};
  if (!accessToken) {
    return res.status(400).json({ error: "Missing Facebook access token." });
  }
  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(
        accessToken
      )}`
    );
    if (!response.ok) {
      return res.status(401).json({ error: "Facebook token verification failed. Please try signing in again." });
    }
    const profile = await response.json();
    if (!profile.email) {
      return res.status(400).json({ error: "Facebook did not return an email address. Please use email/password registration." });
    }
    const email = profile.email;
    const user = upsertOAuthUser({
      provider: "facebook",
      providerId: profile.id,
      email,
      name: profile.name || "Facebook User",
      photoUrl: profile.picture?.data?.url,
      emailVerified: true,
    });
    issueSession(res, user);
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    console.error("Facebook OAuth error:", err);
    res.status(502).json({ error: "Could not reach Facebook to verify sign-in. Please try again." });
  }
});
