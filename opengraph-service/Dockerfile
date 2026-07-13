# Multi-stage build for opengraph-service. Mirrors how html-to-image (Node) and
# anubis (Go) build/run exclusively via their images — there is no host Go
# install (hard constraint #10 in the investigation).
#
# Stage 1: build the shim binary.
FROM golang:1.26-alpine AS builder

WORKDIR /src

# Cache deps: copy go.mod first and download before bringing in source.
COPY go.mod go.sum* ./
RUN go mod download

COPY . .

# Static build for a distroless runtime. CGO disabled so we can ship a
# gcr.io/distroless/static image.
ENV CGO_ENABLED=0 GOOS=linux
RUN go build -trimpath -ldflags="-s -w" -o /out/shim ./cmd/shim

# Stage 2: distroless static runtime — no shell, no package manager.
#
# NOTE: the shim now embeds Caddy (internal/shim/caddyproxy.go) for its
# pass-through reverse-proxy path. Caddy's reverse_proxy module directly
# imports caddytls, which pulls in the full ACME/PKI stack (including AWS/GCP
# KMS client libraries) as dead code — none of it executes since TLS is fully
# disabled on the embedded engine, but it does inflate the binary (~13MB ->
# ~78MB) and the dependency graph (+140 modules) compiled into this image.
# That's a real tradeoff against the "minimal CVE surface" distroless was
# chosen for below — evaluate whether it's worth it before relying on this
# in production; see the PR description for the alternative (a plain
# httputil.ReverseProxy, ~50 lines, zero extra dependencies) that avoids it.
#
# Uses the root-running variant (not :nonroot) because Railway bind-mounts
# volumes as root-owned, shadowing anything the image pre-creates at the mount
# path. A :nonroot uid 65532 can't mkdir under a root-owned bind mount, so the
# cache init crashes with EACCES on startup. Running as root lets the shim
# create /data/og-cache on the mounted volume. Distroless still ships no shell
# or package manager, so the privilege exposure is bounded.
FROM gcr.io/distroless/static-debian12

WORKDIR /
COPY --from=builder /out/shim /shim

EXPOSE 8080
ENTRYPOINT ["/shim"]
