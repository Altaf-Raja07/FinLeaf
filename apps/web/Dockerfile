# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps — installed once and reused by every later stage.
# ---------------------------------------------------------------------------
FROM node:26-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# Install scripts are needed: they fetch the Prisma query/schema engines.
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# builder — generate the Prisma client and build the Next.js output.
# ---------------------------------------------------------------------------
FROM node:26-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The client is generated against the checked-in contract; no database is
# needed, so this runs at build time.
RUN npx prisma generate
RUN npm run build

# ---------------------------------------------------------------------------
# migrate — a short-lived job that applies migrations and seeds reference data.
# ---------------------------------------------------------------------------
FROM node:26-alpine AS migrate
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json ./
COPY src/generated ./src/generated
COPY data ./data
COPY scripts ./scripts

# ---------------------------------------------------------------------------
# runner — the production server.
# ---------------------------------------------------------------------------
FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache libc6-compat openssl \
 && addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
