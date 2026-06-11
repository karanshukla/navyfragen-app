FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite env vars are baked in at build time
ARG VITE_API_URL=/api
ARG VITE_SHORTLINK_URL
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SHORTLINK_URL=$VITE_SHORTLINK_URL

RUN npm run build

# ── Runtime ──────────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
