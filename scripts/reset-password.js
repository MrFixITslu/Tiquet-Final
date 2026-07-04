#!/usr/bin/env node
/**
 * scripts/reset-password.js
 * Safely reset a user password from the command line.
 *
 * Usage:
 *   node scripts/reset-password.js <email> <new-password>
 *
 * Example:
 *   node scripts/reset-password.js admin@example.com "NewSecurePass1!"
 *
 * Never commit this file with hardcoded credentials.
 */
import db from '../server/db.js';
import bcrypt from 'bcryptjs';

const [,, email, password] = process.argv;

if (!email || !password) {
    console.error('Usage: node scripts/reset-password.js <email> <new-password>');
    process.exit(1);
}

if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
}

const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
}

const hashedPassword = await bcrypt.hash(password, 12);
const result = db.prepare("UPDATE users SET password_hash = ? WHERE email = ?").run(hashedPassword, email);

if (result.changes > 0) {
    console.log(`✅ Password reset successfully for: ${email}`);
} else {
    console.error('❌ Failed to update password.');
    process.exit(1);
}

process.exit(0);
