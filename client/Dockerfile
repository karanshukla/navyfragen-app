FROM node:24-alpine
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

EXPOSE 4173

# --host binds to 0.0.0.0 so Caddy can reach this container
CMD ["npm", "run", "preview", "--", "--host"]
