FROM prom/prometheus:latest

COPY prometheus.yml /prometheus/prometheus.yml
COPY auth/web.yml /prometheus/auth/

# Expose the Prometheus web UI port.
# The base image likely already exposes this, but being explicit is harmless.
EXPOSE 9090

# The base image has ENTRYPOINT ["/bin/prometheus"].
# We provide the command-line arguments for Prometheus via CMD.
CMD [ \
    "--config.file=/prometheus/prometheus.yml", \
    "--storage.tsdb.path=/prometheus/data", \
    "--web.console.libraries=/usr/share/prometheus/console_libraries", \
    "--web.console.templates=/usr/share/prometheus/consoles", \
    "--web.config.file=/prometheus/auth/web.yml" \
]
