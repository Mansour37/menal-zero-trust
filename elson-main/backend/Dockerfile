# ── Backend Dockerfile ──
# node:22-alpine épinglé par digest (P1-1) du 2026-08-06 — mise à jour
# uniquement par PR explicite.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS builder
WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runner
WORKDIR /app
ENV NODE_ENV=production

# FFmpeg for audio post-processing (denoise, normalize, convert)
# yt-dlp (LATEST, not the stale alpine apk) + python3 for media ingestion.
RUN apk add --no-cache ffmpeg python3 wget && \
    wget -q https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Security: non-root user
RUN addgroup --system --gid 1001 api && \
    adduser --system --uid 1001 api

# Copy built app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy TS sources for the seed/migrate/admin scripts (tsx) — src entier,
# car migrate.ts & create-admin.ts importent ../db.js et ../config.js.
# init.sql + migrations sont aussi embarqués pour le runner db:migrate (P1-1).
COPY --from=builder /app/src ./src
COPY --from=builder /app/sql ./sql
COPY --from=builder /app/tsconfig.json ./

# Copy entrypoint
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create recordings dir
RUN mkdir -p /data/recordings && chown -R api:api /data/recordings

USER api
EXPOSE 4000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
