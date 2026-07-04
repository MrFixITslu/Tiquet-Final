# V79Tiquetnew — Workflow Review & Production Readiness Report

**Repo reviewed:** `MrFixITslu/V79Tiquetnew`
**Scope:** full-stack app — Express/better-sqlite3 backend, React/Vite frontend, Docker/Nginx/PM2 deployment.

I could not push directly to your GitHub repo (no write credentials configured), so the fixes below are provided as a patch file plus the four fully-fixed server files. Apply the patch, or copy the `*.fixed.js` files over their originals.

## How to apply

```bash
cd V79Tiquetnew
git apply security-fixes.patch   # applies the 4 code fixes
cp gitignore .gitignore          # add the missing .gitignore
```

---

## 🔴 Critical bugs fixed

### 1. Cross-tenant file disclosure in `secureFilePath` (server/security.js)
The path-traversal guard resolved the requested path, confirmed it stayed inside the uploads root, then tried to verify it belonged to the caller's account — but the check (`relative.startsWith(firstSegment)`) was comparing the path's first segment to *itself*, so it was always true. It never actually compared against the caller's `accountId`.

**Impact:** an authenticated user from Account A could request `/api/files/accountA/../accountB/clientX/job1/contract.pdf` and — because `path.join()` normalizes the `..`  — receive Account B's files. This is a full cross-tenant file leak.

**Fix:** the first path segment is now compared against the caller's sanitized account ID, using the same sanitization the app already uses when creating folders, so legitimate paths are unaffected. Verified with a standalone test: own-account access still resolves; the cross-tenant and root-escape traversal attempts are now both rejected (`null`).

### 2. IDOR on job messages (server/index.js)
`GET /api/jobs/:id/messages` never checked that the job belonged to the caller's account — any authenticated user could read another tenant's client chat by guessing/enumerating job IDs. `POST /api/jobs/:id/messages` had the same gap: it inserted a message tied to any `jobId` without verifying ownership, so a user could write into another tenant's job.

**Fix:** both routes now look up the job scoped by `account_id` first and 404 if it doesn't belong to the caller, matching the pattern already used everywhere else in the file.

### 3. Demo data unconditionally seeded on empty database (server/db.js)
If `jobs` table is empty, the app seeds demo data — including a **working login account** (`john@example.com`, role Admin, full permissions) with a **fixed, hardcoded bcrypt hash** — with no environment check. A fresh production deploy pointed at an empty database volume would get this account for free, and the password hash is the same in every deployment of this codebase (i.e., effectively public).

**Fix:** seeding now only runs when `NODE_ENV !== 'production'`, or when an operator explicitly opts in with `SEED_DEMO_DATA=true` (useful for staging/demo boxes). Production skips seeding and logs why.

### 4. Repo hygiene: `node_modules/`, `dist/`, and test databases committed to git
There was no `.gitignore` at all. `node_modules` (20k+ files), the built `dist/` output, and `test-data.db` / `-shm` / `-wal` were all tracked in git. This bloats the repo, risks shipping stale builds, and can leak local test data.

**Fix:** added a `.gitignore` covering `node_modules/`, `dist/`, `.env*`, `*.db*`, `uploads/`, `logs/`. You'll still need to untrack the already-committed files once:
```bash
git rm -r --cached node_modules dist test-data.db test-data.db-shm test-data.db-wal
git commit -m "Stop tracking node_modules, dist, and test databases"
```

---

## 🟠 Fixed: minor but worth doing

### 5. Stripe route error leakage (server/stripe.js)
Every route in `stripe.js` returned raw `e.message` to the client on a 500, regardless of environment — inconsistent with the rest of the app (which gates internal error detail behind `isProduction`). Fixed to match the app-wide pattern.

---

## 🟡 Flagged, not code-fixed (needs a product/business decision)

### 6. Stripe integration is fully simulated
`server/stripe.js` is explicitly a mock — `POST /api/stripe/simulate-subscribe` lets any authenticated user activate any paid plan on their own account with **no real payment, no Stripe SDK calls, and no webhook**. This is clearly labeled in code comments and in the API response (`simulatedMode: true`), so it may be intentional for your current stage — but if this is meant to be "production ready" for actually collecting money, this is the biggest gap in the app. Real Stripe integration would need:
- `stripe.checkout.sessions.create()` for `create-checkout-session`
- A `/api/stripe/webhook` endpoint with **signature verification** (`stripe.webhooks.constructEvent`) to actually activate subscriptions — never trust a client-called endpoint to grant paid access
- `stripe.billingPortal.sessions.create()` for the customer portal

### 7. Facebook OAuth account linking trusts an unverified email
`findOrCreateOAuthUser()` links a new OAuth login to an existing account purely by matching email address. Google's flow explicitly checks `email_verified` before doing this; the Facebook flow does not (Facebook's basic Graph API `/me` call doesn't reliably expose a verification flag). In principle, someone could create a Facebook account using someone else's email and hijack that person's V79 Tick-It account. If Facebook login stays enabled, consider either requiring a confirmation step before linking, or not auto-linking Facebook accounts to existing password-based accounts at all.

### 8. JWT stored in `localStorage` (src/lib/api.ts)
Standard for SPAs but worth knowing: `localStorage` is readable by any script running on the page, so a successful XSS anywhere in the app becomes a full account takeover. An `httpOnly` cookie-based session would remove this risk if you want to harden further; not a blocker given the app already strips HTML tags from user input server-side.

---

## ✅ What was already solid
Genuinely good production practices already in place, worth calling out:
- Multi-tenant scoping (`account_id`) applied consistently across almost all routes
- bcrypt with cost factor 12, brute-force lockout after 10 failed logins, per-route rate limiting
- Helmet CSP, CORS allowlist gated by `NODE_ENV`
- JWT secrets required at boot in production (fails fast if missing)
- 2FA (TOTP) support, OAuth (Google/Apple/Facebook) with proper ID-token verification for Google/Apple
- Multer upload destination resolved server-side from the authenticated job/account, not from client input
- Docker: multi-stage build, non-root user, health check, PM2 pinned to a single instance (correct call for SQLite + WAL)
- Path-traversal check already present on file deletion (`filePath.startsWith(folder)`)

---

## Files in this delivery
- `security-fixes.patch` — unified diff for items 1, 2, 3, 5 (apply with `git apply`)
- `gitignore` — rename to `.gitignore` and commit
- `index.fixed.js`, `security.fixed.js`, `db.fixed.js`, `stripe.fixed.js` — full fixed files, in case the patch doesn't apply cleanly
