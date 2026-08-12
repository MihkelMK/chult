FROM node:24.19.0-alpine3.23@sha256:244cc2b53f46f9e876304391d17682b0ddae9ac33491f4857e25e35a36ba7995 AS base

#
# INSTALL STAGE
#
FROM base AS prod-deps

# Access PNPM with Corepack
RUN corepack enable && \
  apk update && apk add curl bash

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Fetch deps with caching.
# --prod matters: `pnpm fetch` materialises node_modules/.pnpm straight from the
# lockfile and ignores the manifest, so without it the virtual store keeps every dev
# package. `pnpm install --prod` then only drops the top-level links, and the dev
# packages ride along into the runtime image (that is how esbuild's Go binaries ended
# up there).
RUN --mount=type=cache,id=chult-pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm fetch --prod --frozen-lockfile

# Install prod deps with caching
RUN --mount=type=cache,id=chult-pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --prod

#
# BUILD STAGE
#
FROM base AS build

RUN corepack enable && \
  apk update && apk add curl bash

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Fetch deps with caching
RUN --mount=type=cache,id=chult-pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm fetch --frozen-lockfile
# Install all deps with caching
RUN --mount=type=cache,id=chult-pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

# Copy only files needed for build (layer caching optimization)
# Config files change less frequently - copy first for better caching
COPY svelte.config.js vite.config.ts tsconfig.json ./
COPY drizzle.config.ts components.json ./

# Source code changes frequently - copy last
COPY scripts ./scripts
COPY src ./src
COPY static ./static
COPY drizzle ./drizzle

# Accept build args for $env/static/* variables (baked into compiled code)
ARG PUBLIC_MAX_IMAGE_SIZE
ENV PUBLIC_MAX_IMAGE_SIZE=${PUBLIC_MAX_IMAGE_SIZE}

# Silence "not defined" error while building. (Error still good for runtime debugging)
RUN echo PRIVATE_DATABASE_URL="postgresql://user:password@host:5432/database" > .env

# Build the application with caching and increased memory
RUN --mount=type=cache,id=chult-pnpm-cache,target=/root/.cache/pnpm \
  NODE_OPTIONS="--max-old-space-size=4096" NODE_ENV=production pnpm run build

#
# PRODUCTION STAGE
#
FROM base

# Install netcat for healthcheck and add nodejs user.
# apk upgrade because the base image is digest-pinned: without it the image keeps
# whatever package versions were current when that digest was built.
# npm is removed because the runtime only runs `node`, and npm's bundled dependencies
# (tar, sigstore, ip-address, ...) are a standing source of CVEs in the scan.
RUN apk upgrade --no-cache && \
  apk add --no-cache netcat-openbsd && \
  rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx && \
  addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# Need package.json for "type": "module" — build/index.js and scripts/migrate.js are ESM
COPY --from=build /app/package.json ./package.json
# Generated migration SQL, applied by scripts/migrate.js at startup.
# drizzle.config.ts and schema.ts are not copied: those are drizzle-kit inputs, and
# drizzle-kit is a dev dependency (it bundles esbuild, which fails the image scan).
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts/migrate.js ./scripts/migrate.js
COPY entrypoint.sh /app/entrypoint.sh

# Set ownership and permissions
RUN chmod +x entrypoint.sh && \
  chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD wget -q --tries 1 --spider http://127.0.0.1:3000 || exit 1

# Entrypoint with db migration
ENTRYPOINT [ "/app/entrypoint.sh" ]
CMD ["node", "build/index.js"]
