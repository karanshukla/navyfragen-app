FROM node:24-alpine AS builder
WORKDIR /app

# Build tools required for better-sqlite3 and sharp native bindings
RUN apk add --no-cache python3 make g++

# Copy workspace manifests so npm ci can use the root lock file
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# --ignore-scripts skips postinstall (tsup) — source isn't here yet
RUN npm ci --ignore-scripts

# Copy server source and compile
COPY server/ ./server/
RUN npm run build --workspace=server

# Strip devDependencies before copying to the runtime image
RUN npm prune --omit=dev --ignore-scripts

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM node:24-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/dist ./dist
COPY server/package.json ./package.json

EXPOSE 3000

CMD ["node", "dist/index.js"]
