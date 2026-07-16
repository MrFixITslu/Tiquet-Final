# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Build the React/Vite frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# better-sqlite3 needs to compile a native addon on Alpine (musl) if no prebuilt
# binary matches this platform. puppeteer is a devDependency but its postinstall
# tries to download Chromium — not needed for the frontend build, and it can fail
# builds outright in network-restricted environments (proxies, offline CI, etc.).
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
# Using npm install rather than npm ci: ci requires package-lock.json to match
# package.json byte-for-byte, which is brittle when package.json gets hand-edited
# between builds. install reconciles the lock file automatically instead of
# hard-failing.
RUN npm install

COPY . .
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production runtime. server/index.js serves the API + WebSocket AND
# the built frontend directly (express.static on ./dist when NODE_ENV=production)
# — a single container, matching the existing convention of sitting behind your
# own external Nginx Proxy Manager (VIRTUAL_HOST/VIRTUAL_PORT below), rather than
# bundling a second nginx layer inside this container.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package.json package-lock.json* ./

# Install production deps only. better-sqlite3 still needs build tools to compile
# if no prebuilt binary matches — install them, build, then remove to keep the
# final image slim. Using npm install (not ci) for the same reason as the builder
# stage — tolerant of the lock file being slightly behind package.json.
RUN apk add --no-cache python3 make g++ && \
    npm install --omit=dev && \
    apk del python3 make g++ && \
    rm -rf /root/.npm /root/.node-gyp

COPY server/ ./server/
COPY --from=builder /app/dist ./dist

# Runtime volume (mounted by docker-compose): /app/data holds the SQLite file
RUN mkdir -p data && chown -R appuser:appgroup /app

USER appuser

EXPOSE 4010

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:4010/health || exit 1

CMD ["node", "server/index.js"]
