# Build stage: Node is only needed to compile the app.
FROM node:lts-alpine AS build-env

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime stage: static files served by nginx, running as a non-root user.
FROM nginxinc/nginx-unprivileged:alpine

# Where /feature-voting is forwarded; compose's api service by default.
ENV API_UPSTREAM=api:3000

# Templates are rendered with envsubst into conf.d when the container starts.
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build-env /app/dist/web/browser /usr/share/nginx/html

EXPOSE 8080
