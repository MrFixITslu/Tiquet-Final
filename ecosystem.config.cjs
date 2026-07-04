/**
 * ecosystem.config.cjs — PM2 Configuration
 *
 * IMPORTANT: instances is set to 1 because better-sqlite3 is a
 * synchronous, file-based database.  Multiple Node processes writing
 * to the same SQLite file concurrently — even in WAL mode — can corrupt
 * the database or cause SQLITE_BUSY errors under load.
 *
 * If you migrate to PostgreSQL in the future, you can safely increase
 * instances to 'max' for CPU-bound scaling.
 */
module.exports = {
  apps: [
    {
      name: 'v79-tickit-backend',
      script: 'server/index.js',
      instances: 1,           // Single instance — required for SQLite safety
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: 'logs/pm2-err.log',
      out_file:   'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
    }
  ]
};
