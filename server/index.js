import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import { authRouter } from "./auth.js";
import { businessRouter } from "./businesses.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

app.disable("x-powered-by");
app.set("trust proxy", 1); // needed for correct req.ip / rate-limiting behind Nginx
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "https://www.gstatic.com", "https://apis.google.com", "https://connect.facebook.net"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": [
          "'self'",
          "https://www.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://graph.facebook.com",
        ],
        "frame-src": ["'self'", "https://accounts.google.com", "https://www.facebook.com"],
        "frame-ancestors": ["'none'"],
        "base-uri": ["'self'"],
        "object-src": ["'none'"],
      },
    },
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/businesses", businessRouter);

app.get("/api/health", (req, res) => res.json({ ok: true }));

// Serve the built frontend (npm run build -> dist/) for everything else,
// with SPA fallback so client-side routing / refreshes work.
const distPath = path.join(__dirname, "..", "dist");
app.use(express.static(distPath));
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// Central error handler - keeps stack traces out of API responses.
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  res.status(500).json({ error: "Internal server error." });
});

app.listen(PORT, () => {
  console.log(`V79 Tick-It server listening on port ${PORT} (env: ${process.env.NODE_ENV || "development"})`);
});
