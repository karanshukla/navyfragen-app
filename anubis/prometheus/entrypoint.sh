#!/bin/sh

# Substitute environment variables in Prometheus configuration
envsubst < /prometheus/prometheus.yml.template > /prometheus/prometheus.yml

# Execute the original CMD
exec /bin/prometheus --config.file=/prometheus/prometheus.yml \
     --storage.tsdb.path=/prometheus/data \
     --web.console.libraries=/usr/share/prometheus/console_libraries \
     --web.console.templates=/usr/share/prometheus/consoles \
     --web.config.file=/prometheus/auth/web.yml
