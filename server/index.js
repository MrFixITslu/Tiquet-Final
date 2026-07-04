import 'dotenv/config';
import express from "express";
import cors from "cors";
import db from "./db.js";
import { sendPortalLink, sendStatusUpdate } from "./email.js";
import { registerOAuthRoutes } from "./oauth.js";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import multer from "multer";
import { registerStripeRoutes } from "./stripe.js";
import { registerHealthCheck } from "./healthcheck.js";
import { logger } from "./logger.js";
import { 
    sanitizeString, 
    sanitizeObject, 
    isValidEmail, 
    isValidUUID, 
    secureFilePath,
    validatePassword,
    badRequest 
} from "./security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === "production";

registerHealthCheck(app);

const JWT_SECRET = process.env.JWT_SECRET;
const SA_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET;

if (isProduction && (!JWT_SECRET || !SA_JWT_SECRET)) {
    console.error("FATAL: JWT_SECRET or SUPER_ADMIN_JWT_SECRET not set in production.");
    process.exit(1);
}

// ── Security Middleware ───────────────────────────────────────────────────

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "https:", "http:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: [],
        },
    }
}));

app.use(compression());

// Lockdown CORS to allowlist in production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5174', 'http://127.0.0.1:5174'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || !isProduction) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '1mb' }));

// ── Authentication Middleware (declared early — used before rate-limiter setup) ─

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: "Forbidden" });
        req.user = user;
        req.accountId = user.account_id;

        // ─── Suspension Check ─────────────────────────────────────────────
        try {
            const account = db.prepare("SELECT status FROM accounts WHERE id = ?").get(user.account_id);
            if (account && account.status === 'suspended') {
                return res.status(402).json({ error: "ACCOUNT_SUSPENDED", message: "This account has been suspended. Please contact support." });
            }
        } catch (e) {
            // Non-fatal: continue if accounts table check fails
        }

        next();
    });
};

// --- Super Admin Middleware ---
const superAdminMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, SA_JWT_SECRET, (err, decoded) => {
        if (err || !decoded.isSuperAdmin) return res.status(403).json({ error: "Forbidden: Super Admin access required" });
        req.superAdmin = decoded;
        next();
    });
};

// --- FILE REPOSITORY SETUP ---
const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_ROOT)) fs.mkdirSync(UPLOADS_ROOT, { recursive: true });
// Serve uploaded files statically ONLY IN DEVELOPMENT
if (!isProduction) {
    app.use('/uploads', express.static(UPLOADS_ROOT));
}

/**
 * SECURE FILE SERVING
 * All file access in production must go through this authenticated route.
 */
app.get('/api/files/:accountId/*', authenticateToken, (req, res) => {
    const { accountId } = req.params;
    const relativePath = req.params[0];

    // Auth parity check: token must match requested account's files
    if (req.accountId !== accountId) {
        logger.audit('file_access_denied', { 
            userId: req.user.id, 
            requestedAccountId: accountId, 
            actualAccountId: req.accountId 
        });
        return res.status(403).json({ error: "Access denied to this account's files" });
    }

    const safePath = secureFilePath(UPLOADS_ROOT, accountId, path.join(accountId, relativePath));
    if (!safePath || !fs.existsSync(safePath)) {
        return res.status(404).json({ error: "File not found" });
    }

    // Security: Only allow safe file types to be served
    const ext = path.extname(safePath).toLowerCase();
    const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.pdf', '.docx', '.json', '.txt', '.zip'];
    if (!ALLOWED_EXTS.includes(ext)) {
        return res.status(403).json({ error: "File type not permitted" });
    }

    res.sendFile(safePath);
});

/**
 * Sanitize a string for use as a folder or file name component.
 */
const sanitizeForPath = (str) => (str || 'unknown').replace(/[^a-zA-Z0-9_\-. ]/g, '_').trim().slice(0, 60);

/**
 * Get the absolute path to a job's dedicated folder.
 * Pattern: uploads/<AccountId>/<ClientName>/<JobId>/
 */
const getJobFolder = (accountId, clientName, jobId) => {
    return path.join(UPLOADS_ROOT, sanitizeForPath(accountId), sanitizeForPath(clientName), jobId);
};

/**
 * Ensure the job's folder exists. Returns the folder path.
 */
const ensureJobFolder = (accountId, clientName, jobId) => {
    const folder = getJobFolder(accountId, clientName, jobId);
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    return folder;
};

/**
 * Append an entry to the project's audit log (project-log.json inside the job folder).
 */
const appendProjectLog = (accountId, clientName, jobId, entry) => {
    try {
        const folder = ensureJobFolder(accountId, clientName, jobId);
        const logPath = path.join(folder, 'project-log.json');
        let log = [];
        if (fs.existsSync(logPath)) {
            log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        }
        log.push({ ...entry, timestamp: new Date().toISOString() });
        fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
    } catch(e) {
        console.error('Log write error:', e.message);
    }
};

/**
 * Save/update the quote snapshot JSON inside the job folder.
 */
const saveQuoteSnapshot = (accountId, clientName, jobId, jobData) => {
    try {
        const folder = ensureJobFolder(accountId, clientName, jobId);
        fs.writeFileSync(path.join(folder, 'quote.json'), JSON.stringify(jobData, null, 2));
    } catch(e) {
        console.error('Quote snapshot error:', e.message);
    }
};

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 200, 
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again after 15 minutes." }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15, // Stricter for auth
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts, please try again after 15 minutes." }
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30, // 30 uploads per 15 mins
    standardHeaders: true,
    legacyHeaders: false,
});

app.use("/api/auth", authLimiter);
app.use("/api/", apiLimiter);

// --- AUTHENTICATION ROUTES ---
registerOAuthRoutes(app);  // Google + Apple OAuth

app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, companyName } = sanitizeObject(req.body);
    if (!name || !email || !password || !companyName) {
        return badRequest(res, "All fields are required");
    }

    if (!isValidEmail(email)) return badRequest(res, "Invalid email format");
    
    const pwError = validatePassword(password);
    if (pwError) return badRequest(res, pwError);

    try {
        const existingUser = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
        if (existingUser) return badRequest(res, "Email already exists");

        const accountId = uuidv4();
        const userId = uuidv4();
        const hashedPassword = await bcrypt.hash(password, 12); // Increased rounds for production
        
        const registerTx = db.transaction(() => {
            db.prepare("INSERT INTO accounts (id, name, createdAt) VALUES (?, ?, ?)").run(accountId, companyName, new Date().toISOString());
            db.prepare("INSERT INTO users (id, name, email, role, password_hash, account_id) VALUES (?, ?, ?, ?, ?, ?)").run(userId, name, email, "Admin", hashedPassword, accountId);
            db.prepare("INSERT INTO settings (id, name, email, account_id) VALUES (?, ?, ?, ?)").run(uuidv4(), companyName, email, accountId);
        });
        registerTx();

        logger.audit('user_registered', { userId, email, accountId });

        const token = jwt.sign({ id: userId, email, account_id: accountId }, JWT_SECRET, { expiresIn: '8h' });
        res.status(201).json({ token, user: { id: userId, name, email, role: "Admin", account_id: accountId } });
    } catch (e) {
        logger.error(`Registration error: ${e.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/api/auth/login", async (req, res) => {
    const { email, password } = sanitizeObject(req.body);
    if (!email || !password) return badRequest(res, "Email and password required");

    try {
        const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
        if (!user) {
            return res.status(400).json({ error: "Invalid credentials" });
        }
        // OAuth-only users have no password — direct them to the right login method
        if (!user.password_hash) {
            const provider = user.oauth_provider;
            const hint = provider ? ` Please sign in with ${provider.charAt(0).toUpperCase() + provider.slice(1)}.` : '';
            return res.status(400).json({ error: `This account uses social sign-in.${hint}` });
        }

        // --- Brute Force Protection ---
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            logger.audit('login_locked', { email });
            return res.status(423).json({ error: "Account locked due to too many failed attempts. Try again later." });
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            const attempts = (user.failed_login_attempts || 0) + 1;
            let lockedUntil = null;
            
            if (attempts >= 10) {
                // Lock for 15 minutes after 10 fails
                lockedUntil = new Date(Date.now() + 15 * 60000).toISOString();
                logger.audit('user_locked', { email, userId: user.id });
            }

            db.prepare("UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?")
              .run(attempts, lockedUntil, user.id);

            return res.status(400).json({ error: "Invalid credentials" });
        }

        // Success: Reset failed attempts
        db.prepare("UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?")
          .run(user.id);

        if (user.twoFactorEnabled === 1) {
            const tempToken = jwt.sign({ id: user.id, isTemp2FA: true }, JWT_SECRET, { expiresIn: '5m' });
            return res.json({ requires2FA: true, tempToken });
        }

        const token = jwt.sign({ id: user.id, email: user.email, account_id: user.account_id }, JWT_SECRET, { expiresIn: '8h' });
        
        logger.audit('login_success', { userId: user.id, email: user.email });

        // Strip sensitive data
        const { password_hash, twoFactorSecret, ...safeUser } = user;
        res.json({ token, user: safeUser });
    } catch (e) {
        logger.error(`Login error: ${e.message}`);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post("/api/auth/login/2fa", (req, res) => {
    const { tempToken, code } = req.body;
    if (!tempToken || !code) return res.status(400).json({ error: "Missing token or code" });

    jwt.verify(tempToken, JWT_SECRET, (err, decoded) => {
        if (err || !decoded.isTemp2FA) return res.status(403).json({ error: "Invalid or expired temporary token" });

        const user = db.prepare("SELECT * FROM users WHERE id = ?").get(decoded.id);
        if (!user || user.twoFactorEnabled !== 1 || !user.twoFactorSecret) {
            return res.status(400).json({ error: "2FA is not properly set up for this user" });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code,
            window: 1
        });

        if (!verified) return res.status(400).json({ error: "Invalid 2FA code" });

        const token = jwt.sign({ id: user.id, email: user.email, account_id: user.account_id }, JWT_SECRET, { expiresIn: '1d' });
        delete user.password_hash;
        delete user.twoFactorSecret;
        res.json({ token, user });
    });
});

app.get("/api/auth/me", authenticateToken, (req, res) => {
    try {
        const user = db.prepare("SELECT id, name, email, role, account_id, twoFactorEnabled FROM users WHERE id = ? AND account_id = ?").get(req.user.id, req.accountId);
        if (!user) return res.status(404).json({ error: "User not found" });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// 2FA Setup endpoints
app.post("/api/auth/2fa/generate", authenticateToken, async (req, res) => {
    try {
        const secret = speakeasy.generateSecret({ name: `Auvic (${req.user.email})` });
        const dataUrl = await qrcode.toDataURL(secret.otpauth_url);
        
        db.prepare("UPDATE users SET twoFactorSecret = ? WHERE id = ?").run(secret.base32, req.user.id);
        
        res.json({ secret: secret.base32, qrCode: dataUrl });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

app.post("/api/auth/2fa/verify", authenticateToken, (req, res) => {
    const { code } = req.body;
    try {
        const user = db.prepare("SELECT twoFactorSecret FROM users WHERE id = ?").get(req.user.id);
        if (!user || !user.twoFactorSecret) return res.status(400).json({ error: "No 2FA secret found. Generate one first." });
        
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: code,
            window: 1
        });
        
        if (verified) {
            db.prepare("UPDATE users SET twoFactorEnabled = 1 WHERE id = ?").run(req.user.id);
            res.json({ success: true });
        } else {
            res.status(400).json({ error: "Invalid validation code" });
        }
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

app.post("/api/auth/2fa/disable", authenticateToken, (req, res) => {
    try {
        db.prepare("UPDATE users SET twoFactorEnabled = 0, twoFactorSecret = NULL WHERE id = ?").run(req.user.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});


// Helpers for nested relations
const getJobTags = (jobId) => {
    return db.prepare("SELECT tag FROM job_tags WHERE job_id = ?").all(jobId).map(row => row.tag);
};

const getJobActivityLogs = (jobId) => {
    return db.prepare("SELECT * FROM activity_logs WHERE job_id = ? ORDER BY timestamp ASC").all(jobId);
};

const getJobMessages = (jobId) => {
    return db.prepare("SELECT * FROM job_messages WHERE job_id = ? ORDER BY timestamp ASC").all(jobId);
};

const createNotification = ({ userId, title, message, type, accountId }) => {
    try {
        db.prepare(`
            INSERT INTO notifications (id, user_id, title, message, type, createdAt, account_id, isRead)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0)
        `).run(uuidv4(), userId, title, message, type, new Date().toISOString(), accountId);
    } catch (e) {
        console.error("Failed to create notification:", e.message);
    }
};

/**
 * Advanced Stage Transition Helper
 * Logs current timer, starts new timer, handles auto-assignment and notifications.
 */
const updateJobStage = (id, newStatus, accountId, userName = "System") => {
    const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND account_id = ?").get(id, accountId);
    if (!job) return null;

    let timeLogs = job.timeLogs ? JSON.parse(job.timeLogs) : [];
    const now = new Date().toISOString();

    // 1. Log previous timer segment if exists
    if (job.timerStartedAt) {
        const elapsed = (new Date(now).getTime() - new Date(job.timerStartedAt).getTime()) / (1000 * 60 * 60);
        if (elapsed > 0) {
            timeLogs.push({
                id: uuidv4(),
                employeeId: job.assignedTo || "unassigned",
                startTime: job.timerStartedAt,
                endTime: now,
                status: job.status
            });
        }
    }

    // 2. Automations: Stage Assignments
    let assignedTo = job.assignedTo;
    const stageAssignments = job.stageAssignments ? JSON.parse(job.stageAssignments) : {};
    if (stageAssignments[newStatus]) {
        assignedTo = stageAssignments[newStatus];
    }

    // 3. Status-specific logic: Stop timer if finished
    const isFinished = ['completed', 'paid'].includes(newStatus);
    const timerStartedAt = isFinished ? null : now;

    // 4. Update DB
    db.prepare(`
        UPDATE jobs SET 
            status = ?, 
            timeLogs = ?, 
            timerStartedAt = ?, 
            assignedTo = ?
        WHERE id = ? AND account_id = ?
    `).run(newStatus, JSON.stringify(timeLogs), timerStartedAt, assignedTo, id, accountId);

    // 5. Activity Log
    db.prepare("INSERT INTO activity_logs (id, job_id, action, timestamp, user, account_id) VALUES (?, ?, ?, ?, ?, ?)")
        .run(uuidv4(), id, `Stage advanced to ${newStatus}${assignedTo !== job.assignedTo ? ` and auto-assigned to ${assignedTo}` : ''}`, now, userName, accountId);

    // 6. Notifications
    if (assignedTo) {
        const userMatch = db.prepare("SELECT id FROM users WHERE name = ? AND account_id = ?").get(assignedTo, accountId);
        if (userMatch) {
            createNotification({
                userId: userMatch.id,
                title: assignedTo !== job.assignedTo ? "Job Assignment Update" : "Job Status Updated",
                message: assignedTo !== job.assignedTo 
                    ? `You have been auto-assigned to "${job.title}" for stage: ${newStatus}`
                    : `"${job.title}" is now: ${newStatus}`,
                type: assignedTo !== job.assignedTo ? "assignment" : "status_change",
                accountId
            });
        }
    }

    return { ...job, status: newStatus, timeLogs, timerStartedAt, assignedTo };
};

// --- API ROUTES (PROTECTED) ---

// Get all jobs
app.get("/api/jobs", authenticateToken, (req, res) => {
    try {
        const jobs = db.prepare("SELECT * FROM jobs WHERE account_id = ? ORDER BY createdAt DESC").all(req.accountId);
        
        const populatedJobs = jobs.map(job => ({
            ...job,
            tags: getJobTags(job.id),
            activityLog: getJobActivityLogs(job.id),
            lineItems: job.lineItems ? JSON.parse(job.lineItems) : [],
            deliverables: job.deliverables ? JSON.parse(job.deliverables) : [],
            timeLogs: job.timeLogs ? JSON.parse(job.timeLogs) : [],
            stageAssignments: job.stageAssignments ? JSON.parse(job.stageAssignments) : {}
        }));

        res.json(populatedJobs);
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Notifications
app.get("/api/notifications", authenticateToken, (req, res) => {
    try {
        const notifications = db.prepare("SELECT * FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND account_id = ? ORDER BY createdAt DESC LIMIT 50")
            .all(req.user.id, req.accountId);
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

app.put("/api/notifications/read", authenticateToken, (req, res) => {
    const { id } = req.body;
    try {
        if (id) {
            db.prepare("UPDATE notifications SET isRead = 1 WHERE id = ? AND account_id = ?").run(id, req.accountId);
        } else {
            db.prepare("UPDATE notifications SET isRead = 1 WHERE user_id = ? AND account_id = ?").run(req.user.id, req.accountId);
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Create a new job
app.post("/api/jobs", authenticateToken, (req, res) => {
    const { id: reqId, title, client, description, status, createdAt, dueDate, amount, priority, invoiceNotes, assignedTo, clientEmail, tags, activityLog, depositPaid, lineItems, deliverables, timerStartedAt, stageAssignments, timeLogs } = req.body;
    const id = reqId || uuidv4();
    const secureToken = uuidv4();

    try {
        const insertJob = db.prepare(`
            INSERT INTO jobs (id, title, client, description, status, createdAt, dueDate, amount, priority, invoiceNotes, assignedTo, clientEmail, secureToken, depositPaid, account_id, lineItems, deliverables, timerStartedAt, stageAssignments, timeLogs)
            VALUES (@id, @title, @client, @description, @status, @createdAt, @dueDate, @amount, @priority, @invoiceNotes, @assignedTo, @clientEmail, @secureToken, @depositPaid, @account_id, @lineItems, @deliverables, @timerStartedAt, @stageAssignments, @timeLogs)
        `);

        insertJob.run({ 
            id, title, client, description, status, createdAt, dueDate, amount, priority, invoiceNotes, assignedTo, clientEmail, secureToken, 
            depositPaid: depositPaid ? 1 : 0, 
            account_id: req.accountId,
            lineItems: lineItems ? JSON.stringify(lineItems) : null,
            deliverables: deliverables ? JSON.stringify(deliverables) : null,
            timerStartedAt: timerStartedAt || new Date().toISOString(), // Ensure timer ALWAYS starts
            stageAssignments: stageAssignments ? JSON.stringify(stageAssignments) : null,
            timeLogs: timeLogs ? JSON.stringify(timeLogs) : "[]" // Default to empty array
        });

        if (tags && tags.length > 0) {
            const insertTag = db.prepare('INSERT INTO job_tags (job_id, tag, account_id) VALUES (?, ?, ?)');
            tags.forEach(tag => insertTag.run(id, tag, req.accountId));
        }

        if (activityLog && activityLog.length > 0) {
            const insertActivity = db.prepare('INSERT INTO activity_logs (id, job_id, action, timestamp, user, account_id) VALUES (@id, @job_id, @action, @timestamp, @user, @account_id)');
            activityLog.forEach(log => insertActivity.run({ ...log, job_id: id, account_id: req.accountId }));
        }

        // Auto-create/update client profile
        if (client) {
            const existingClient = db.prepare("SELECT id FROM clients WHERE name = ? AND account_id = ?").get(client, req.accountId);
            if (existingClient) {
                if (clientEmail) db.prepare("UPDATE clients SET email = ? WHERE id = ?").run(clientEmail, existingClient.id);
            } else {
                db.prepare("INSERT INTO clients (id, name, email, phone, company, notes, createdAt, account_id) VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)").run(uuidv4(), client, clientEmail || null, new Date().toISOString(), req.accountId);
            }
        }

        // --- AUTO-CREATE FILE REPOSITORY FOLDER ---
        try {
            const jobFolder = ensureJobFolder(req.accountId, client || 'unknown', id);
            // Write a README so the folder is clearly labelled
            const readme = `# Project: ${title}\nClient: ${client}\nJob ID: ${id}\nCreated: ${new Date().toISOString()}\n\nThis folder contains all files, quotes, invoices, and logs for this project.\n`;
            fs.writeFileSync(path.join(jobFolder, 'README.md'), readme);
            // Seed initial project log
            appendProjectLog(req.accountId, client || 'unknown', id, {
                type: 'job_created',
                action: 'Job created',
                user: req.user?.email || 'System',
                details: { title, client, status, amount }
            });
        } catch(folderErr) {
            console.error('Could not create job folder:', folderErr.message);
            // Non-fatal — don't block job creation
        }

        // --- NOTIFICATION ---
        if (assignedTo) {
            const assignedUser = db.prepare("SELECT id FROM users WHERE name = ? AND account_id = ?").get(assignedTo, req.accountId);
            if (assignedUser) {
                createNotification({
                    userId: assignedUser.id,
                    title: "New Job Assigned",
                    message: `You have been assigned to: ${title}`,
                    type: "assignment",
                    accountId: req.accountId
                });
            }
        }

        const newJob = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
        res.status(201).json({
            ...newJob,
            tags: getJobTags(id),
            activityLog: getJobActivityLogs(id),
            lineItems: newJob.lineItems ? JSON.parse(newJob.lineItems) : [],
            deliverables: newJob.deliverables ? JSON.parse(newJob.deliverables) : [],
            timeLogs: newJob.timeLogs ? JSON.parse(newJob.timeLogs) : [],
            stageAssignments: newJob.stageAssignments ? JSON.parse(newJob.stageAssignments) : {}
        });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Update a job
app.put("/api/jobs/:id", authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { title, client, description, status, dueDate, amount, priority, invoiceNotes, assignedTo, clientEmail, tags, activityLog, depositPaid, quoteApproved, lineItems, deliverables, timerStartedAt, stageAssignments, timeLogs } = req.body;

    try {
        const existingJob = db.prepare("SELECT status, secureToken, clientEmail, title, stageAssignments FROM jobs WHERE id = ? AND account_id = ?").get(id, req.accountId);
        if (!existingJob) return res.status(404).json({ error: "Job not found" });

        // BLOCK manual PAID transition
        if (status === 'paid' && existingJob.status !== 'paid') {
            return res.status(403).json({ error: "Job status cannot be manually moved to 'Paid'. This occurs automatically upon payment confirmation." });
        }

        const statusChanged = status && existingJob.status !== status;
        let finalStatus = status || existingJob.status;
        let finalAssignedTo = assignedTo;
        let finalTimerStartedAt = timerStartedAt;
        let finalTimeLogs = timeLogs;

        // AUTO-ADVANCE: If in 'request' and now assigned, move to 'estimation'
        if (finalStatus === 'request' && assignedTo && !existingJob.assignedTo) {
             finalStatus = 'estimation';
             console.log(`AUTO-ADVANCE: Job ${id} assigned to ${assignedTo}. Moving to 'estimation'.`);
        }

        // AUTOMATION: If status changed (either manually or via auto-advance)
        if (finalStatus !== existingJob.status) {
            const result = updateJobStage(id, finalStatus, req.accountId, req.user?.email || "User");
            if (result) {
                finalAssignedTo = result.assignedTo;
                finalTimerStartedAt = result.timerStartedAt;
                finalTimeLogs = result.timeLogs;
            }
        }

        const updateJob = db.prepare(`
            UPDATE jobs SET 
                title = @title, client = @client, description = @description, status = @status, 
                dueDate = @dueDate, amount = @amount, priority = @priority, invoiceNotes = @invoiceNotes, 
                assignedTo = @assignedTo, clientEmail = @clientEmail, depositPaid = @depositPaid,
                quoteApproved =  COALESCE(@quoteApproved, quoteApproved),
                lineItems = @lineItems, deliverables = @deliverables, timerStartedAt = @timerStartedAt,
                stageAssignments = @stageAssignments, timeLogs = @timeLogs
            WHERE id = @id AND account_id = @account_id
        `);

        updateJob.run({ 
            id, title, client, description, status: finalStatus, dueDate, amount, priority, invoiceNotes, 
            assignedTo: finalAssignedTo, clientEmail, 
            depositPaid: depositPaid ? 1 : 0, 
            quoteApproved: quoteApproved !== undefined ? (quoteApproved ? 1 : 0) : null,
            account_id: req.accountId,
            lineItems: lineItems ? JSON.stringify(lineItems) : null,
            deliverables: deliverables ? JSON.stringify(deliverables) : null,
            timerStartedAt: finalTimerStartedAt !== undefined ? finalTimerStartedAt : null,
            stageAssignments: stageAssignments ? JSON.stringify(stageAssignments) : (existingJob.stageAssignments || null),
            timeLogs: finalTimeLogs ? (typeof finalTimeLogs === 'string' ? finalTimeLogs : JSON.stringify(finalTimeLogs)) : null
        });

        if (tags) {
            db.prepare('DELETE FROM job_tags WHERE job_id = ? AND account_id = ?').run(id, req.accountId);
            const insertTag = db.prepare('INSERT INTO job_tags (job_id, tag, account_id) VALUES (?, ?, ?)');
            tags.forEach(tag => insertTag.run(id, tag, req.accountId));
        }

        if (activityLog && activityLog.length > 0) {
            const insertActivity = db.prepare('INSERT OR IGNORE INTO activity_logs (id, job_id, action, timestamp, user, account_id) VALUES (@id, @job_id, @action, @timestamp, @user, @account_id)');
            activityLog.forEach(log => insertActivity.run({ ...log, job_id: id, account_id: req.accountId }));
        }

        const recipientEmail = clientEmail || existingJob?.clientEmail;
        const jobTitle = title || existingJob?.title;
        const token = existingJob?.secureToken;

        if (statusChanged && recipientEmail && token) {
            sendStatusUpdate(recipientEmail, jobTitle, status, token)
                .then(r => console.log(`📧 Status update email ${r.success ? 'sent' : 'failed'} to ${recipientEmail}`))
                .catch(e => console.error('Email error:', e));
        }

        // --- NOTIFICATION ---
        // (Handled by updateJobStage for status/assignment changes)

        const updatedJob = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
        res.json({
            ...updatedJob,
            tags: getJobTags(id),
            activityLog: getJobActivityLogs(id),
            lineItems: updatedJob.lineItems ? JSON.parse(updatedJob.lineItems) : [],
            deliverables: updatedJob.deliverables ? JSON.parse(updatedJob.deliverables) : [],
            timeLogs: updatedJob.timeLogs ? JSON.parse(updatedJob.timeLogs) : [],
            stageAssignments: updatedJob.stageAssignments ? JSON.parse(updatedJob.stageAssignments) : {}
        });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});


// Send portal link email
app.post("/api/jobs/:id/send-portal", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND account_id = ?").get(id, req.accountId);
        if (!job) return res.status(404).json({ error: "Job not found" });
        if (!job.clientEmail) return res.status(400).json({ error: "Client does not have an email address" });

        const result = await sendPortalLink(job.clientEmail, job.title, job.secureToken);

        if (result.success) {
            res.json({ success: true, previewUrl: result.previewUrl });
        } else {
            res.status(500).json({ error: result.error || "Failed to send email" });
        }
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Send Quote workflow email
app.post("/api/jobs/:id/send-quote", authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND account_id = ?").get(id, req.accountId);
        if (!job) return res.status(404).json({ error: "Job not found" });
        if (!job.clientEmail) return res.status(400).json({ error: "Client does not have an email address" });

        // Update status to estimation if it was request
        if(job.status === "request") {
            db.prepare("UPDATE jobs SET status = 'estimation' WHERE id = ?").run(id);
        }

        // We can reuse sendPortalLink for now, or imagine adapting it to explicitly say "Quote Approval"
        const result = await sendPortalLink(job.clientEmail, `Quote Ready: ${job.title}`, job.secureToken);

        if (result.success) {
            db.prepare("INSERT INTO activity_logs (id, job_id, action, timestamp, user, account_id) VALUES (?, ?, ?, ?, ?, ?)")
                .run(uuidv4(), job.id, "Quote link sent to client", new Date().toISOString(), req.user.email, req.accountId);
            res.json({ success: true, previewUrl: result.previewUrl });
        } else {
            res.status(500).json({ error: result.error || "Failed to send quote email" });
        }
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Get business settings
app.get("/api/settings", authenticateToken, (req, res) => {
    try {
        const settings = db.prepare("SELECT * FROM settings WHERE account_id = ? LIMIT 1").get(req.accountId);
        res.json(settings || {});
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Update business settings
app.put("/api/settings", authenticateToken, (req, res) => {
    const { name, address, email, phone, logoUrl, paymentTerms, currency, taxRate } = req.body;
    try {
        db.prepare(`
            UPDATE settings 
            SET name = ?, address = ?, email = ?, phone = ?, logoUrl = ?, paymentTerms = ?, currency = ?, taxRate = ? 
            WHERE account_id = ?
        `).run(name, address, email, phone, logoUrl, paymentTerms, currency, taxRate, req.accountId);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Get all employees
app.get("/api/employees", authenticateToken, (req, res) => {
    try {
        const employees = db.prepare("SELECT * FROM employees WHERE account_id = ?").all(req.accountId);
        res.json(employees);
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Get all clients with job summary
app.get("/api/clients", authenticateToken, (req, res) => {
    try {
        const clients = db.prepare("SELECT * FROM clients WHERE account_id = ? ORDER BY name ASC").all(req.accountId);
        const clientsWithStats = clients.map(c => {
            const jobs = db.prepare("SELECT id, title, status, amount, createdAt, dueDate, priority, assignedTo FROM jobs WHERE client = ? AND account_id = ?").all(c.name, req.accountId);
            const totalRevenue = jobs.reduce((sum, j) => sum + (j.amount || 0), 0);
            const activeJobs = jobs.filter(j => !['completed', 'invoiced'].includes(j.status)).length;
            return { ...c, jobs, totalJobs: jobs.length, activeJobs, totalRevenue };
        });
        res.json(clientsWithStats);
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Update client contact info
app.put("/api/clients/:id", authenticateToken, (req, res) => {
    const { id } = req.params;
    const { phone, company, notes, email } = req.body;
    try {
        db.prepare("UPDATE clients SET phone = ?, company = ?, notes = ?, email = ? WHERE id = ? AND account_id = ?")
            .run(phone || null, company || null, notes || null, email || null, id, req.accountId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// Job Messages (Chat)
app.get("/api/jobs/:id/messages", authenticateToken, (req, res) => {
    try {
        // SECURITY: verify the job belongs to the caller's account before returning messages
        const job = db.prepare("SELECT id FROM jobs WHERE id = ? AND account_id = ?").get(req.params.id, req.accountId);
        if (!job) return res.status(404).json({ error: "Job not found" });

        const messages = getJobMessages(req.params.id);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

app.post("/api/jobs/:id/messages", authenticateToken, (req, res) => {
    const { id: jobId } = req.params;
    const { sender, content } = req.body;
    const id = uuidv4();
    const timestamp = new Date().toISOString();

    try {
        // SECURITY: verify the job belongs to the caller's account before writing a message to it
        const job = db.prepare("SELECT client FROM jobs WHERE id = ? AND account_id = ?").get(jobId, req.accountId);
        if (!job) return res.status(404).json({ error: "Job not found" });

        db.prepare("INSERT INTO job_messages (id, job_id, sender, content, timestamp, account_id) VALUES (?, ?, ?, ?, ?, ?)")
            .run(id, jobId, sender, content, timestamp, req.accountId);

        // Append to project log
        appendProjectLog(req.accountId, job.client, jobId, {
            type: 'message',
            action: `Message sent by ${sender}`,
            user: sender,
            details: { content: (content || '').slice(0, 200) }
        });

        res.status(201).json({ id, jobId, sender, content, timestamp });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// --- FILE REPOSITORY ENDPOINTS ---

// Dynamic multer storage — destination is set per-job folder
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            const job = db.prepare("SELECT client, account_id FROM jobs WHERE id = ? AND account_id = ?").get(req.params.id, req.accountId);
            if (!job) return cb(new Error('Job not found'), null);
            const folder = ensureJobFolder(req.accountId, job.client, req.params.id);
            cb(null, folder);
        } catch(e) { cb(e, null); }
    },
    filename: (req, file, cb) => {
        // Prefix with timestamp to avoid collisions, preserve original name
        const safe = file.originalname.replace(/[^a-zA-Z0-9_.\-]/g, '_');
        cb(null, `${Date.now()}-${safe}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB per file
});

// POST /api/jobs/:id/files  — upload one or many files into the job folder
app.post("/api/jobs/:id/files", authenticateToken, upload.array('files', 20), (req, res) => {
    const { id: jobId } = req.params;
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });

        const job = db.prepare("SELECT client FROM jobs WHERE id = ? AND account_id = ?").get(jobId, req.accountId);
        const uploaded = req.files.map(f => ({
            name: f.originalname,
            filename: f.filename,
            size: f.size,
            mimetype: f.mimetype,
            url: `/uploads/${sanitizeForPath(req.accountId)}/${sanitizeForPath(job?.client || 'unknown')}/${jobId}/${f.filename}`,
            uploadedAt: new Date().toISOString()
        }));

        // Log the upload
        if (job) {
            appendProjectLog(req.accountId, job.client, jobId, {
                type: 'file_upload',
                action: `${req.files.length} file(s) uploaded`,
                user: req.user?.email || 'Team',
                details: { files: uploaded.map(f => f.name) }
            });
        }

        res.status(201).json({ success: true, files: uploaded });
    } catch(error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// GET /api/jobs/:id/files  — list all files in the job folder
app.get("/api/jobs/:id/files", authenticateToken, (req, res) => {
    const { id: jobId } = req.params;
    try {
        const job = db.prepare("SELECT client FROM jobs WHERE id = ? AND account_id = ?").get(jobId, req.accountId);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        const folder = getJobFolder(req.accountId, job.client, jobId);
        if (!fs.existsSync(folder)) return res.json({ files: [], log: [] });

        const entries = fs.readdirSync(folder, { withFileTypes: true })
            .filter(e => e.isFile() && e.name !== 'project-log.json')
            .map(e => {
                const stat = fs.statSync(path.join(folder, e.name));
                return {
                    filename: e.name,
                    // Original name: strip leading timestamp prefix if present
                    name: e.name.replace(/^\d+-/, ''),
                    size: stat.size,
                    uploadedAt: stat.mtime.toISOString(),
                    url: `/uploads/${sanitizeForPath(req.accountId)}/${sanitizeForPath(job.client)}/${jobId}/${e.name}`
                };
            });

        // Also read project log
        const logPath = path.join(folder, 'project-log.json');
        const log = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];

        res.json({ files: entries, log });
    } catch(error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

// DELETE /api/jobs/:id/files/:filename  — delete a specific file from the job folder
app.delete("/api/jobs/:id/files/:filename", authenticateToken, (req, res) => {
    const { id: jobId, filename } = req.params;
    try {
        const job = db.prepare("SELECT client FROM jobs WHERE id = ? AND account_id = ?").get(jobId, req.accountId);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        const folder = getJobFolder(req.accountId, job.client, jobId);
        const filePath = path.join(folder, filename);

        // Security: ensure file is inside the job folder (prevent path traversal)
        if (!filePath.startsWith(folder)) return res.status(403).json({ error: 'Forbidden' });
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

        fs.unlinkSync(filePath);
        appendProjectLog(req.accountId, job.client, jobId, {
            type: 'file_deleted',
            action: `File deleted: ${filename}`,
            user: req.user?.email || 'Team',
        });
        res.json({ success: true });
    } catch(error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});


// --- CLIENT PORTAL PUBLIC SECURE ROUTES ---

// Helper to get settings for a public portal
const getSettingsForPortal = (accountId) => {
    return db.prepare("SELECT * FROM settings WHERE account_id = ? LIMIT 1").get(accountId) || {};
}

// Secure endpoint for client portal
app.get("/api/portal/:token", (req, res) => {
    const { token } = req.params;
    try {
        const job = db.prepare("SELECT * FROM jobs WHERE secureToken = ?").get(token);
        if (!job) return res.status(404).json({ error: "Invalid link" });

        const populatedJob = {
            ...job,
            activityLog: getJobActivityLogs(job.id),
            messages: getJobMessages(job.id),
            lineItems: job.lineItems ? JSON.parse(job.lineItems) : [],
            deliverables: job.deliverables ? JSON.parse(job.deliverables) : [],
            timeLogs: job.timeLogs ? JSON.parse(job.timeLogs) : [],
            stageAssignments: job.stageAssignments ? JSON.parse(job.stageAssignments) : {},
            timerStartedAt: job.timerStartedAt
        };
        const settings = getSettingsForPortal(job.account_id);
        res.json({ job: populatedJob, settings });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

app.post("/api/portal/:token/approve-quote", (req, res) => {
    const { token } = req.params;
    try {
        const job = db.prepare("SELECT id, account_id FROM jobs WHERE secureToken = ?").get(token);
        if (!job) return res.status(404).json({ error: "Invalid link" });

        // Automate stage transition to 'in-progress'
        updateJobStage(job.id, 'in-progress', job.account_id, 'Client Portal');

        db.prepare("UPDATE jobs SET quoteApproved = 1 WHERE id = ?").run(job.id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

app.post("/api/portal/:token/pay-deposit", (req, res) => {
    const { token } = req.params;
    try {
        const job = db.prepare("SELECT id, account_id FROM jobs WHERE secureToken = ?").get(token);
        if (!job) return res.status(404).json({ error: "Invalid link" });

        db.prepare("UPDATE jobs SET depositPaid = 1 WHERE id = ?").run(job.id);
        db.prepare("INSERT INTO activity_logs (id, job_id, action, timestamp, user, account_id) VALUES (?, ?, ?, ?, ?, ?)")
            .run(uuidv4(), job.id, "30% Deposit paid via portal", new Date().toISOString(), "Client", job.account_id);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

app.post("/api/portal/:token/pay-final", (req, res) => {
    const { token } = req.params;
    try {
        const job = db.prepare("SELECT id, account_id FROM jobs WHERE secureToken = ?").get(token);
        if (!job) return res.status(404).json({ error: "Invalid link" });

        // Automate stage transition to 'paid' (this will stop the timer)
        updateJobStage(job.id, 'paid', job.account_id, 'Client Portal');

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});

app.post("/api/portal/:token/messages", (req, res) => {
    const { token } = req.params;
    const { sender, content } = req.body;
    try {
        const job = db.prepare("SELECT id, account_id FROM jobs WHERE secureToken = ?").get(token);
        if (!job) return res.status(404).json({ error: "Invalid link" });

        const id = uuidv4();
        const timestamp = new Date().toISOString();
        db.prepare("INSERT INTO job_messages (id, job_id, sender, content, timestamp, account_id) VALUES (?, ?, ?, ?, ?, ?)")
            .run(id, job.id, sender, content, timestamp, job.account_id);
        
        res.status(201).json({ id, jobId: job.id, sender, content, timestamp });
    } catch (error) {
        res.status(500).json({ error: isProduction ? "Internal Server Error" : error.message });
    }
});


// ══════════════════════════════════════════════════════════════════════════════
// SUPER ADMIN ROUTES
// ══════════════════════════════════════════════════════════════════════════════

const saLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

// POST /api/superadmin/login
app.post('/api/superadmin/login', saLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    try {
        const admin = db.prepare("SELECT * FROM super_admins WHERE email = ?").get(email);
        if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
        const valid = await bcrypt.compare(password, admin.password_hash);
        if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
        const token = jwt.sign({ id: admin.id, email: admin.email, isSuperAdmin: true }, SA_JWT_SECRET, { expiresIn: '8h' });
        res.json({ token, admin: { id: admin.id, email: admin.email } });
    } catch (e) {
        res.status(500).json({ error: isProduction ? 'Internal Server Error' : e.message });
    }
});

// GET /api/superadmin/stats
app.get('/api/superadmin/stats', superAdminMiddleware, (req, res) => {
    try {
        const totalAccounts = db.prepare("SELECT count(*) as c FROM accounts").get().c;
        const activeAccounts = db.prepare("SELECT count(*) as c FROM accounts WHERE status = 'active'").get().c;
        const suspendedAccounts = db.prepare("SELECT count(*) as c FROM accounts WHERE status = 'suspended'").get().c;
        const totalUsers = db.prepare("SELECT count(*) as c FROM users").get().c;
        const totalJobs = db.prepare("SELECT count(*) as c FROM jobs").get().c;
        const activeSubs = db.prepare("SELECT count(*) as c FROM subscriptions WHERE status = 'active'").get().c;
        const trialSubs = db.prepare("SELECT count(*) as c FROM subscriptions WHERE status = 'trialing'").get().c;
        const canceledSubs = db.prepare("SELECT count(*) as c FROM subscriptions WHERE status = 'canceled'").get().c;
        // MRR: sum plan prices for active subscriptions
        const planPrices = { starter: 29, pro: 79, enterprise: 199, trial: 0 };
        const activePlans = db.prepare("SELECT plan, count(*) as c FROM subscriptions WHERE status = 'active' GROUP BY plan").all();
        const mrr = activePlans.reduce((sum, row) => sum + (planPrices[row.plan] || 0) * row.c, 0);
        const newSignups30d = db.prepare("SELECT count(*) as c FROM accounts WHERE createdAt >= datetime('now', '-30 days')").get().c;

        res.json({ totalAccounts, activeAccounts, suspendedAccounts, totalUsers, totalJobs, activeSubs, trialSubs, canceledSubs, mrr, newSignups30d });
    } catch (e) {
        res.status(500).json({ error: isProduction ? 'Internal Server Error' : e.message });
    }
});

// GET /api/superadmin/accounts
app.get('/api/superadmin/accounts', superAdminMiddleware, (req, res) => {
    try {
        const accounts = db.prepare("SELECT * FROM accounts ORDER BY createdAt DESC").all();
        const enriched = accounts.map(acc => {
            const sub = db.prepare("SELECT * FROM subscriptions WHERE account_id = ? ORDER BY createdAt DESC LIMIT 1").get(acc.id);
            const userCount = db.prepare("SELECT count(*) as c FROM users WHERE account_id = ?").get(acc.id).c;
            const jobCount = db.prepare("SELECT count(*) as c FROM jobs WHERE account_id = ?").get(acc.id).c;
            const settings = db.prepare("SELECT name, email, logoUrl FROM settings WHERE account_id = ? LIMIT 1").get(acc.id);
            return { ...acc, subscription: sub || null, userCount, jobCount, settings: settings || {} };
        });
        res.json(enriched);
    } catch (e) {
        res.status(500).json({ error: isProduction ? 'Internal Server Error' : e.message });
    }
});

// GET /api/superadmin/accounts/:id
app.get('/api/superadmin/accounts/:id', superAdminMiddleware, (req, res) => {
    try {
        const acc = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id);
        if (!acc) return res.status(404).json({ error: 'Account not found' });
        const sub = db.prepare("SELECT * FROM subscriptions WHERE account_id = ? ORDER BY createdAt DESC LIMIT 1").get(acc.id);
        const users = db.prepare("SELECT id, name, email, role, twoFactorEnabled FROM users WHERE account_id = ?").all(acc.id);
        const jobs = db.prepare("SELECT id, title, status, amount, createdAt FROM jobs WHERE account_id = ? ORDER BY createdAt DESC LIMIT 20").all(acc.id);
        const settings = db.prepare("SELECT * FROM settings WHERE account_id = ? LIMIT 1").get(acc.id);
        res.json({ ...acc, subscription: sub || null, users, recentJobs: jobs, settings: settings || {} });
    } catch (e) {
        res.status(500).json({ error: isProduction ? 'Internal Server Error' : e.message });
    }
});

// PUT /api/superadmin/accounts/:id/suspend
app.put('/api/superadmin/accounts/:id/suspend', superAdminMiddleware, (req, res) => {
    try {
        db.prepare("UPDATE accounts SET status = 'suspended', suspendedAt = ? WHERE id = ?").run(new Date().toISOString(), req.params.id);
        res.json({ success: true, message: 'Account suspended' });
    } catch (e) {
        res.status(500).json({ error: isProduction ? 'Internal Server Error' : e.message });
    }
});

// PUT /api/superadmin/accounts/:id/unsuspend
app.put('/api/superadmin/accounts/:id/unsuspend', superAdminMiddleware, (req, res) => {
    try {
        db.prepare("UPDATE accounts SET status = 'active', suspendedAt = NULL WHERE id = ?").run(req.params.id);
        res.json({ success: true, message: 'Account unsuspended' });
    } catch (e) {
        res.status(500).json({ error: isProduction ? 'Internal Server Error' : e.message });
    }
});

// DELETE /api/superadmin/accounts/:id
app.delete('/api/superadmin/accounts/:id', superAdminMiddleware, (req, res) => {
    const { id } = req.params;
    if (id === 'default_account') return res.status(403).json({ error: 'Cannot delete the default account' });
    try {
        const tables = ['jobs', 'job_tags', 'activity_logs', 'employees', 'users', 'user_permissions', 'files', 'clients', 'job_messages', 'notifications', 'settings', 'subscriptions'];
        db.transaction(() => {
            for (const t of tables) {
                try { db.prepare(`DELETE FROM ${t} WHERE account_id = ?`).run(id); } catch(e) {}
            }
            db.prepare("DELETE FROM accounts WHERE id = ?").run(id);
        })();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: isProduction ? 'Internal Server Error' : e.message });
    }
});

// GET /api/superadmin/subscriptions
app.get('/api/superadmin/subscriptions', superAdminMiddleware, (req, res) => {
    try {
        const subs = db.prepare("SELECT s.*, a.name as accountName, a.status as accountStatus FROM subscriptions s LEFT JOIN accounts a ON s.account_id = a.id ORDER BY s.createdAt DESC").all();
        res.json(subs);
    } catch (e) {
        res.status(500).json({ error: isProduction ? 'Internal Server Error' : e.message });
    }
});

// PUT /api/superadmin/accounts/:id/change-plan
app.put('/api/superadmin/accounts/:id/change-plan', superAdminMiddleware, (req, res) => {
    const { plan } = req.body;
    const validPlans = ['trial', 'starter', 'pro', 'enterprise'];
    if (!validPlans.includes(plan)) return res.status(400).json({ error: 'Invalid plan' });
    try {
        db.prepare("UPDATE accounts SET plan = ? WHERE id = ?").run(plan, req.params.id);
        db.prepare("UPDATE subscriptions SET plan = ? WHERE account_id = ?").run(plan, req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: isProduction ? 'Internal Server Error' : e.message });
    }
});

// ══════════════════════════════════════════════════════════════════════════════
// STRIPE ROUTES
// ══════════════════════════════════════════════════════════════════════════════
registerStripeRoutes(app, authenticateToken);

// Serve static frontend files in production
if (isProduction) {
    app.use(express.static(path.join(__dirname, '../dist')));
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    });
}

// Purge logs older than 30 days on startup
logger.rotateLogs(30);

app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Backend server running on port ${PORT} in ${isProduction ? 'production' : 'development'} mode`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use.`);
        process.exit(1);
    } else {
        logger.error(`Server error: ${err.message}`);
    }
});
