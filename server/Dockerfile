FROM node:24-alpine AS builder
WORKDIR /app

# Build tools required for better-sqlite3 native bindings
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
# postinstall runs tsup and compiles the TypeScript source to dist/
RUN npm ci

COPY . .

# Remove dev dependencies — native binaries are already compiled for this platform
RUN npm prune --omit=dev

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

EXPOSE 3000

CMD ["node", "dist/index.js"]
