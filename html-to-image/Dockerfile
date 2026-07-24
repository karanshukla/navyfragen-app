FROM node:24-alpine

RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto-emoji \
      tini

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /usr/src/app

COPY package.json ./
RUN npm install --omit=dev

COPY app.js ./

EXPOSE 3033

# Chromium's children are reparented to PID 1 when the browser exits. Node does
# not reap orphans, so running it as PID 1 turns every browser close into a
# handful of permanent zombie entries — and since the pool now launches and
# closes Chromium once per idle cycle rather than once per container lifetime,
# those accumulate until the PID table is exhausted. tini reaps them.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "app.js"]
