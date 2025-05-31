FROM prom/prometheus:latest

# Set working directory
WORKDIR /prometheus

# Copy configuration files
# Use the /prometheus directory instead of /etc/prometheus since the 'nobody' user should have write access to it
COPY prometheus.yml /prometheus/prometheus.yml.template
COPY auth/web.yml /prometheus/auth/
COPY entrypoint.sh /prometheus/entrypoint.sh

# Make entrypoint script executable
RUN chmod +x /prometheus/entrypoint.sh

# Expose the Prometheus web UI port
EXPOSE 9090

# The Prometheus image already runs as the nobody user
ENTRYPOINT ["/prometheus/entrypoint.sh"]
CMD []
