# anubis/Dockerfile

# Step 1: Start FROM the official Anubis image on GHCR
FROM ghcr.io/techarohq/anubis:latest

# Step 2: Define the internal container path for the policy file.
ARG ANUBIS_POLICY_INTERNAL_PATH=/data/cfg/botPolicy.yaml

# Step 3: Create the directory if it doesn't exist
RUN mkdir -p /data/cfg

# Step 4: Copy your custom policy file from your 'anubis/' directory
# into the specified path within the image.
COPY botPolicy.yaml $ANUBIS_POLICY_INTERNAL_PATH

# Step 5: (Optional but recommended for clarity)
# You can set POLICY_FNAME here to ensure it's always set in the image,
ENV POLICY_FNAME=$ANUBIS_POLICY_INTERNAL_PATH