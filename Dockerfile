FROM node:20-alpine AS base

#
# INSTALL STAGE
#
FROM base AS prod-deps

# Access PNPM with Corepack
RUN corepack enable && \
  apk update && apk add curl bash

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Fetch deps with caching
RUN --mount=type=cache,id=chult-pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm fetch --frozen-lockfile

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

COPY package.json pnpm-lock.yaml ./
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
COPY src ./src
COPY static ./static
COPY drizzle ./drizzle

# Accept build args for $env/static/* variables (baked into compiled code)
ARG PUBLIC_MAX_IMAGE_SIZE
ENV PUBLIC_MAX_IMAGE_SIZE=${PUBLIC_MAX_IMAGE_SIZE}

# Load secrets read from environment to .env during build
ARG POSTGRES_HOST
RUN --mount=type=secret,id=PRIVATE_DM_TOKEN,env=PRIVATE_DM_TOKEN \
  --mount=type=secret,id=IMGPROXY_KEY,env=IMGPROXY_KEY \
  --mount=type=secret,id=IMGPROXY_SALT,env=IMGPROXY_SALT \
  --mount=type=secret,id=IMGPROXY_URL,env=IMGPROXY_URL \
  --mount=type=secret,id=POSTGRES_USER,env=POSTGRES_USER \
  --mount=type=secret,id=POSTGRES_PASSWORD,env=POSTGRES_PASSWORD \
  --mount=type=secret,id=POSTGRES_DB,env=POSTGRES_DB \
  printf "PRIVATE_DATABASE_URL='postgresql://%s:%s@%s:5432/%s'\nPRIVATE_DM_TOKEN=%s\nIMGPROXY_KEY=%s\nIMGPROXY_SALT=%s\nIMGPROXY_URL=%s\n" \
  "$POSTGRES_USER" "$POSTGRES_PASSWORD" "${POSTGRES_HOST}" "$POSTGRES_DB" "$PRIVATE_DM_TOKEN" "$IMGPROXY_KEY" "$IMGPROXY_SALT" "$IMGPROXY_URL" > .env

# Build the application with caching and increased memory
RUN --mount=type=cache,id=chult-pnpm-cache,target=/root/.cache/pnpm \
  NODE_OPTIONS="--max-old-space-size=4096" NODE_ENV=production pnpm run build

#
# PRODUCTION STAGE
#
FROM base

# Install netcat for healthcheck and add nodejs user
RUN corepack enable && \
  apk add --no-cache netcat-openbsd && \
  addgroup -g 1001 -S nodejs && \
  adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# Need package.json to specify PNPM version which Corepack installs
COPY --from=build /app/package.json ./package.json
# Copy Drizzle config so we can migrate prior to building
COPY --from=build /app/src/lib/server/db/schema.ts /app/src/lib/server/db/schema.ts
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
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
