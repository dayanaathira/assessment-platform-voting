# =============================================================================
# REFERENCE ONLY — commented out on purpose. This is not a live build.
# =============================================================================
#
# Almost every service ends up needing a Dockerfile, and DevOps owns the real
# one: base-image policy, registries, and the build pipeline are theirs. This
# file exists so a developer can see what this service needs from an image
# without having to reconstruct it, and so nobody assumes no Dockerfile means
# no image.
#
# It is a working multi-stage build as of the last commit that ran it, not a
# sketch. To use it: uncomment, `docker build -t <service> .`, and expect
# DevOps to replace or absorb it.
#
# The parts that are this service's requirements rather than styling, and so
# must survive whatever DevOps does with it:
#
#   - Entry point is `node dist/src/main.js`. `nest build` emits dist/src/,
#     NOT dist/ — an earlier version of this repo shipped `node dist/main`
#     and the image would not start.
#   - Node >= 22.12. MikroORM v7 is ESM-only and the CommonJS build
#     require()s it.
#   - Runs as a non-root USER.
#   - Do NOT add NODE_OPTIONS=--max-old-space-size. A heap hint larger than
#     the container memory limit gets the process OOMKilled before V8
#     collects seriously; Node reads the cgroup limit itself.
#   - Config comes from the environment at run time, never baked in.
#
# See "What this service expects at runtime" in README.md.
#
# =============================================================================

# Build stage
# FROM node:lts-alpine AS build-env

# WORKDIR /app

# Copy package files first for better caching
# COPY package*.json ./

# Clean npm cache and install dependencies
# RUN npm cache clean --force && \
#     npm ci

# Copy source code
# COPY . .

# Build the application
# RUN npm run build

# Remove dev dependencies to save space
# RUN npm prune --omit=dev

# Production stage
# FROM node:lts-alpine

# Deliberately no NODE_OPTIONS=--max-old-space-size here. This image cannot
# know the memory limit a service will be deployed with, and a heap hint larger
# than the container limit gets the process OOMKilled before V8 collects
# seriously. Node reads the cgroup limit on its own.
# RUN apk add --no-cache tzdata

# ENV TZ=Asia/Kuala_Lumpur

# WORKDIR /app

# RUN addgroup -S app && adduser -S app -G app

# Copy only necessary files from build stage
# COPY --from=build-env --chown=app:app /app/dist ./dist
# COPY --from=build-env --chown=app:app /app/node_modules ./node_modules
# COPY --from=build-env --chown=app:app /app/package*.json ./
# COPY --from=build-env --chown=app:app /app/migrations ./migrations

# LABEL maintainer="<team-or-distribution-list@example.com>"

# ARG DEFAULT_PORT=3000
# EXPOSE ${DEFAULT_PORT}

# USER app

# CMD ["node", "dist/src/main.js"]
