# ---- GreenTrack backend: Node.js + Express + Prisma ----

# ===== Stage 1: install dependencies + generate the Prisma client =====
FROM node:20-alpine AS deps
WORKDIR /app

# Install ALL dependencies (including devDependencies) here — Prisma's CLI
# (a devDependency) is needed to generate the client at build time.
# `npm ci` requires package-lock.json and gives a fully reproducible,
# faster install than `npm install` — always prefer it in Docker builds.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY prisma ./prisma
RUN npx prisma generate

# ===== Stage 2: production runtime =====
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies in the final image — keeps it small
# and avoids shipping devDependencies (nodemon, the Prisma CLI itself).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

# Bring over the already-generated Prisma client + engine binaries from the
# deps stage, rather than regenerating (faster, and keeps this stage from
# needing the Prisma CLI at all).
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY src ./src

# Run as a non-root user — the node:alpine image ships a `node` user
# out of the box for exactly this.
RUN chown -R node:node /app
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
