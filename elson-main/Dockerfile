# ── Frontend Dockerfile ──
# node:22-alpine épinglé par digest (P1-1) du 2026-08-06.
FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS builder
WORKDIR /app
# npm 10.9.8 (embarque node:22) fige node-tar 7.5.11 → CVE-2026-59873 (CRITICAL,
# Denial of Service). npm 12 embarque tar 7.5.19 corrigé.
RUN npm install -g npm@12.0.2
COPY package.json ./
COPY package-lock.json ./
RUN npm ci
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

FROM node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32 AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN npm install -g npm@12.0.2

# Security: run as non-root user
RUN addgroup --system --gid 1001 nextjs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
