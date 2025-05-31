# anubis/Dockerfile

# Step 1: Start FROM the official Anubis image on GHCR
FROM ghcr.io/techarohq/anubis:latest

# Step 2: Define arguments for the target path and user/group IDs
ARG ANUBIS_POLICY_INTERNAL_PATH=/data/cfg/botPolicy.json
ARG APP_USER_ID=1000
ARG APP_GROUP_ID=1000

# Step 3: Copy your local 'botPolicy.json' to the defined path in the image.
# This command should create /data/ and /data/cfg/ if they don't exist.
# It also attempts to set ownership to user/group 1000.
COPY --chown=${APP_USER_ID}:${APP_GROUP_ID} botPolicy.json $ANUBIS_POLICY_INTERNAL_PATH

# If COPY --chown gives errors during build, try this simpler version:
# COPY botPolicy.json $ANUBIS_POLICY_INTERNAL_PATH
# Then, if needed and if the base image has a shell and chmod:
# RUN chmod 644 $ANUBIS_POLICY_INTERNAL_PATH

# Step 4: Set POLICY_FNAME environment variable
ENV POLICY_FNAME=$ANUBIS_POLICY_INTERNAL_PATH