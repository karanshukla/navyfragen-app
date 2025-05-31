# Stage 1: Get envsubst utility
FROM alpine:latest AS util
RUN apk add --no-cache gettext
# envsubst is typically in /usr/bin/envsubst after installing gettext

# Stage 2: Main Prometheus image
FROM prom/prometheus:latest

# Switch to root (UID 0) for copying tools and setting permissions
USER 0

WORKDIR /prometheus

# Copy envsubst from the util stage into a common PATH location
COPY --from=util /usr/bin/envsubst /usr/bin/envsubst

# Copy local configuration files
COPY prometheus.yml /prometheus/prometheus.yml.template
COPY auth/web.yml /prometheus/auth/
COPY entrypoint.sh /prometheus/entrypoint.sh # This script uses envsubst

# Make entrypoint script and envsubst executable
# (envsubst from alpine image should already be executable, but doesn't hurt)
RUN chmod +x /prometheus/entrypoint.sh && chmod +x /usr/bin/envsubst

# Switch to the non-privileged 'nobody' user to run Prometheus
USER nobody

# Expose the Prometheus web UI port
EXPOSE 9090

# ENTRYPOINT will run as the 'nobody' user.
# The entrypoint.sh script is expected to use 'envsubst'.
ENTRYPOINT ["/prometheus/entrypoint.sh"]
CMD [] # CMD is cleared because entrypoint.sh handles the full Prometheus command
