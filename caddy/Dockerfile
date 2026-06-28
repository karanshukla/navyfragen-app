FROM caddy:latest

WORKDIR /app

COPY Caddyfile ./

COPY --chmod=755 entrypoint.sh ./

# Strip Windows CRLF line endings in case the file was checked out on Windows
RUN sed -i 's/\r$//' entrypoint.sh

RUN caddy fmt --overwrite Caddyfile

ENTRYPOINT ["/bin/sh"]

CMD ["entrypoint.sh"]