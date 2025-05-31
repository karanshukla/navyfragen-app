# Railway Deployment Guide for Prometheus

This guide explains how to deploy Prometheus to Railway and connect it to other Railway services.

## Prerequisites

- [Railway CLI](https://docs.railway.app/develop/cli) installed and authenticated
- An existing Railway project

## Deployment Steps

### Step 1: Create a New Railway Service for Prometheus

```bash
# Link to your existing Railway project (if not already linked)
railway link

# Create a new service for Prometheus
railway service create prometheus

# Navigate to the prometheus directory
cd /path/to/prometheus

# Deploy to Railway
railway up
```

### Step 2: Configure Internal Service Communication

Railway services in the same project can communicate with each other via internal DNS. To set this up:

1. Find the internal domain for your target service (e.g., Anubis):

   - Go to the Railway dashboard
   - Select your Anubis service
   - Go to the Variables tab
   - Look for the `RAILWAY_PRIVATE_DOMAIN` variable
   - This is the internal hostname for your service

2. Set the environment variable for Prometheus:

   ```bash
   railway variables set RAILWAY_SERVICE_ANUBIS_HOST=$RAILWAY_PRIVATE_ANUBIS_DOMAIN
   ```

   Replace `$RAILWAY_PRIVATE_ANUBIS_DOMAIN` with the actual domain from step 1.

### Step 3: Verify Configuration

After deployment:

1. Access your Prometheus instance using the URL provided by Railway
2. Log in using the credentials in the auth/web.yml file
3. Navigate to Status > Targets to verify the connection to your Anubis service

## Multiple Services

To monitor multiple services, add them to the `prometheus.yml` file:

```yaml
scrape_configs:
  # Other configs...

  - job_name: "service1"
    static_configs:
      - targets: ["$RAILWAY_SERVICE_SERVICE1_HOST:8080"]

  - job_name: "service2"
    static_configs:
      - targets: ["$RAILWAY_SERVICE_SERVICE2_HOST:9000"]
```

And set the corresponding environment variables:

```bash
railway variables set RAILWAY_SERVICE_SERVICE1_HOST=$RAILWAY_PRIVATE_SERVICE1_DOMAIN
railway variables set RAILWAY_SERVICE_SERVICE2_HOST=$RAILWAY_PRIVATE_SERVICE2_DOMAIN
```

## Troubleshooting

- **Connection refused errors**: Ensure the target service exposes metrics on the specified port
- **Service not found**: Verify the environment variables are set correctly
- **Authentication issues**: Check that the auth/web.yml file is correctly mounted
