/**
 * scripts/backup-db.js
 * Creates a timestamped local backup of the SQLite database.
 * Run manually or via cron.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const DB_FILE = path.join(__dirname, '..', 'data.db');

if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(BACKUPS_DIR, `data-backup-${timestamp}.db`);

try {
    if (!fs.existsSync(DB_FILE)) {
        console.error("Database file not found at", DB_FILE);
        process.exit(1);
    }

    // In a production environment with better-sqlite3, you could use db.backup()
    // for a safe live copy. For this script, we'll do a simple file copy.
    fs.copyFileSync(DB_FILE, backupPath);
    
    console.log(`✅ Backup successful: ${backupPath}`);

    // Manage backups: Keep latest 30 only
    const backups = fs.readdirSync(BACKUPS_DIR)
        .filter(f => f.startsWith('data-backup-'))
        .map(f => ({ name: f, time: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

    if (backups.length > 30) {
        backups.slice(30).forEach(b => {
            fs.unlinkSync(path.join(BACKUPS_DIR, b.name));
            console.log(`🗑️ Deleted old backup: ${b.name}`);
        });
    }
} catch (e) {
    console.error(`❌ Backup failed: ${e.message}`);
    process.exit(1);
}
