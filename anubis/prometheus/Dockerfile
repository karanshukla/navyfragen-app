FROM prom/prometheus:latest

# Switch to root (UID 0) for package installation and permission changes
USER 0

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Set working directory
WORKDIR /prometheus

# Copy configuration files
# prometheus.yml.template will be read by envsubst
# auth/web.yml is for web UI auth
# entrypoint.sh is our startup script
COPY prometheus.yml /prometheus/prometheus.yml.template
COPY auth/web.yml /prometheus/auth/
COPY entrypoint.sh /prometheus/entrypoint.sh

# Make entrypoint script executable
RUN chmod +x /prometheus/entrypoint.sh

# Switch back to nobody before setting ENTRYPOINT/CMD
USER nobody

# Expose the Prometheus web UI port
EXPOSE 9090

# ENTRYPOINT will run as the user specified by the last USER directive (nobody).
ENTRYPOINT ["/prometheus/entrypoint.sh"]
CMD [] # CMD is cleared because entrypoint.sh handles the full command
