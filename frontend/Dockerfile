FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.6.0 --activate

# 1. Dependencies stage
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2. Build stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# 3. Production runner stage: plain node image, so pnpm/corepack never reach production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Patch OS packages, drop the bundled npm/corepack/yarn (unused by `node server.js`, vulnerable deps)
# and create a non-root user
RUN apk upgrade --no-cache     && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn /usr/local/bin/yarnpkg     && addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy only the necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
