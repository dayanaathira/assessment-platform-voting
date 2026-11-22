# Build stage
FROM node:lts-alpine AS build-env

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Clean npm cache and install dependencies
RUN npm cache clean --force && \
    npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Remove dev dependencies to save space
RUN npm prune --omit=dev

# Production stage
FROM node:lts-alpine

WORKDIR /app

# Copy only necessary files from build stage
COPY --from=build-env /app/dist ./dist
COPY --from=build-env /app/node_modules ./node_modules
COPY --from=build-env /app/package*.json ./
COPY --from=build-env /app/migrations ./migrations

# Log folders, owned by the unprivileged user the app runs as. Mount a volume
# here to keep logs across container restarts.
RUN mkdir -p logs/applications logs/errors logs/exceptions && \
    chown -R node:node logs

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# The base image ships an unprivileged `node` user.
USER node

CMD ["node", "dist/src/main.js"]
