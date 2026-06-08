FROM alpine:3

RUN apk add --no-cache \
      chromium \
      nodejs \
      npm \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto-emoji

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY . /usr/src/app
RUN cd /usr/src/app && npm install

WORKDIR /usr/src/app
ENV PATH=/usr/src/app/node_modules/.bin:$PATH

EXPOSE 3033

ENTRYPOINT ["node", "/usr/src/app/app.js"]
