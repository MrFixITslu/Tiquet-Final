import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error(
    "FATAL: JWT_SECRET environment variable is missing or too short (needs 16+ chars). " +
      "Set it in your .env file before starting the server. " +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
  process.exit(1);
}

export const COOKIE_NAME = "tickit_session";
export const CSRF_COOKIE_NAME = "tickit_csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CSRF_TTL_MS = SESSION_TTL_MS;

const isProduction = process.env.NODE_ENV === "production";

function cookieOptions({ httpOnly }) {
  return {
    httpOnly,
    secure: isProduction,
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
    path: "/",
  };
}

export function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE_NAME, token, {
    ...cookieOptions({ httpOnly: false }),
    maxAge: CSRF_TTL_MS,
  });
  return token;
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
  res.cookie(COOKIE_NAME, token, cookieOptions({ httpOnly: true }));
  issueCsrfToken(res);
}

export function clearSession(res) {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.clearCookie(CSRF_COOKIE_NAME, { path: "/" });
}

export function authenticate(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ error: "Not authenticated." });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired or invalid. Please log in again." });
  }
}

export function requireCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.get(CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: "Invalid or missing CSRF token." });
  }
  next();
}
