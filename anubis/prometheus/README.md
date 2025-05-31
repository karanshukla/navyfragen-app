# Prometheus with Basic Authentication

This directory contains the configuration for running Prometheus with basic authentication.

## Files

- `Dockerfile`: Builds a Prometheus container with basic authentication enabled
- `prometheus.yml`: The main Prometheus configuration file
- `auth/web.yml`: Basic authentication configuration
- `gen_password.sh`: Helper script to generate new authentication credentials

## Note on Implementation

The Prometheus official image is based on a minimal Linux distribution that doesn't have package managers like apt-get and runs as a non-root user. Key points about this implementation:

1. We're using pre-generated password hashes in the web.yml file rather than generating them in the container
2. A helper script is provided to generate new passwords using a separate Docker container
3. The official Prometheus image already runs as the 'nobody' user, so we don't need to modify user permissions or create directories

## Default Credentials

- Username: `admin`
- Password: `prometheus_admin`

## Building and Running

### Local Development

Build the Docker image:

```bash
docker build -t prometheus-auth .
```

Run the container:

```bash
docker run -d --name prometheus -p 9090:9090 -v $(pwd)/prometheus.yml:/prometheus/prometheus.yml prometheus-auth
```

If you need to modify the configuration files after creating the container, you can mount them as volumes:

```bash
docker run -d --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/prometheus/prometheus.yml \
  -v $(pwd)/auth/web.yml:/prometheus/auth/web.yml \
  prometheus-auth
```

### Deploying to Railway

1. First, add this Prometheus configuration as a new service in your Railway project:

```bash
railway link  # Link to your Railway project if not already linked
railway service create prometheus  # Create a new service for Prometheus
railway up  # Deploy the service to Railway
```

2. To connect to another Railway service (e.g., Anubis), you'll need to set up the environment variable:

```bash
# Get the internal Railway host for the Anubis service
railway variables set RAILWAY_SERVICE_ANUBIS_HOST=$RAILWAY_PRIVATE_ANUBIS_DOMAIN
```

Railway automatically provides environment variables for connecting to other services in the same project. These variables follow the pattern `$RAILWAY_PRIVATE_<SERVICE_NAME>_DOMAIN`.

3. You can verify the connection by checking the Prometheus targets page after deployment.

## Generating New Credentials

To generate a new username and password:

```bash
./gen_password.sh new_username new_password
```

Copy the output and replace the corresponding line in `auth/web.yml`.
