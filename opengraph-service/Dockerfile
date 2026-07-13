# Multi-stage build for opengraph-service. Mirrors how html-to-image (Node) and
# anubis (Go) build/run exclusively via their images — there is no host Go
# install (hard constraint #10 in the investigation).
#
# Stage 1: build the shim binary (+ test helpers as needed).
FROM golang:1.26-alpine AS builder

WORKDIR /src

# Cache deps: copy go.mod first and download before bringing in source.
COPY go.mod go.sum* ./
RUN go mod download

COPY . .

# Static build for a distroless runtime. CGO disabled so we can ship a
# FROM-scratch / gcr.io/distroless/static image.
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags="-s -w" -o /out/shim ./cmd/shim

# Pre-create the cache dir so the runtime stage can copy it with nonroot
# ownership. Docker copies this dir's perms onto a first-mounted named volume.
RUN mkdir -p /out/og-cache

# Stage 2: distroless static runtime — no shell, no package manager, ~minimal CVE surface.
FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /
COPY --from=builder /out/shim /shim

# Pre-create the cache dir as the nonroot user (uid 65532). When a named volume
# is first mounted at /data/og-cache, Docker copies this dir's ownership/perms
# onto the volume, so the nonroot process can write to it. Without this, the
# volume initializes root-owned and the store fails with EACCES.
COPY --from=builder --chown=nonroot:nonroot /out/og-cache /data/og-cache

# nonroot user (uid 65532) is baked into the image.
EXPOSE 8080
ENTRYPOINT ["/shim"]
