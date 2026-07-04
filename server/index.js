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
    // The SPA loads its own bundled JS/CSS with no inline scripts, so a
    // strict default CSP is safe; disable only if you add third-party embeds.
    contentSecurityPolicy: false,
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
