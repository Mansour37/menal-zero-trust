# ── Stage 1 : deps ────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# Copier le lockfile ET utiliser `npm ci` : installe EXACTEMENT les versions
# verrouillees (integrite verifiee). L ancien `npm install --frozen-lockfile`
# etait un non-sens (flag pnpm/yarn inexistant pour npm) + ne copiait pas le
# lockfile -> resolution non reproductible a chaque build (trou chaine d appro).
COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2 : builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3 : runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Le runtime n execute que `node server.js` : npm / corepack / yarn ne servent
# a rien en production, et le npm bundle de l image de base embarque node-tar
# 6.2.1 (CVE-2026-59873 CRITICAL, bloquee par la porte Trivy du CI). Les
# retirer corrige la CVE et reduit la surface de l image finale.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
           /opt/yarn*

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
