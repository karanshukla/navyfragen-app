# anubis/Dockerfile

# Step 1: Start FROM the official Anubis image on GHCR
FROM ghcr.io/techarohq/anubis:latest

# Step 2: Define the internal container path for the policy file.
ARG ANUBIS_POLICY_INTERNAL_PATH=/botPolicy.yaml

# Step 3: Copy your custom policy file from your 'anubis/' directory
# into the specified path within the image.
COPY botPolicy.yaml $ANUBIS_POLICY_INTERNAL_PATH

# Step 4: Set POLICY_FNAME
ENV POLICY_FNAME=$ANUBIS_POLICY_INTERNAL_PATH