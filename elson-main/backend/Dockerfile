# ── Backend Dockerfile ──
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
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

# Copy seed script source + tsx for running it
COPY --from=builder /app/src/scripts ./src/scripts
COPY --from=builder /app/src/config.ts ./src/config.ts
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
