# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the React/Vite frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install ALL dependencies (including devDeps for the build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production runtime (Node only, no build tools)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as a non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./

# better-sqlite3 needs build tools; install then clean up
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++ && \
    rm -rf /root/.npm /root/.node-gyp

# Copy server source
COPY server/ ./server/
COPY scripts/ ./scripts/

# Copy the built frontend from Stage 1
COPY --from=builder /app/dist ./dist

# ── Runtime volumes (mounted by docker-compose) ───────────────────────────────
# /app/data      — SQLite database file (data.db)
# /app/uploads   — user-uploaded files
# /app/logs      — application and audit logs
# /app/backups   — database backups
RUN mkdir -p data uploads logs backups && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3001

# Graceful shutdown support
STOPSIGNAL SIGTERM

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server/index.js"]
