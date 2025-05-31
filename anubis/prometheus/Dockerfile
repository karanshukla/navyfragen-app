FROM prom/prometheus:latest

# Set working directory
WORKDIR /prometheus

# Copy configuration files
# Use the /prometheus directory instead of /etc/prometheus since the 'nobody' user should have write access to it
COPY prometheus.yml /prometheus/
COPY auth/web.yml /prometheus/auth/

# Expose the Prometheus web UI port
EXPOSE 9090

# The Prometheus image already runs as the nobody user
ENTRYPOINT ["/bin/prometheus"]
CMD ["--config.file=/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus/data", \
     "--web.console.libraries=/usr/share/prometheus/console_libraries", \
     "--web.console.templates=/usr/share/prometheus/consoles", \
     "--web.config.file=/prometheus/auth/web.yml"]
