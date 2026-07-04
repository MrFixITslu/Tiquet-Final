#!/usr/bin/env node
/**
 * scripts/generate-secrets.js
 * Run: node scripts/generate-secrets.js
 * Prints cryptographically strong secrets ready to paste into .env
 */
import crypto from 'crypto';

const gen = (bytes = 64) => crypto.randomBytes(bytes).toString('hex');

console.log('\n# ── Generated Secrets ─────────────────────────────────────────');
console.log(`JWT_SECRET=${gen(64)}`);
console.log(`SUPER_ADMIN_JWT_SECRET=${gen(64)}`);
console.log(`COOKIE_SECRET=${gen(32)}`);
console.log(`SESSION_SECRET=${gen(32)}`);
console.log('\n# Paste these into your .env and NEVER commit them to git.\n');
