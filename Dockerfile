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
RUN --mount=type=cache,id=s/<service-id>-/root/.local/share/pnpm/store,target=/root/.local/share/pnpm/store \
  pnpm fetch --frozen-lockfile

# Install prod deps with caching
RUN --mount=type=cache,id=s/<service-id>-/root/.local/share/pnpm/store,target=/root/.local/share/pnpm/store \
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
RUN --mount=type=cache,id=s/<service-id>-/root/.local/share/pnpm/store,target=/root/.local/share/pnpm/store \
  pnpm fetch --frozen-lockfile
# Install all deps with caching
RUN --mount=type=cache,id=s/<service-id>-/root/.local/share/pnpm/store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

COPY . .

# Set Node options for increased memory
ENV NODE_OPTIONS="--max-old-space-size=4096"

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Build the application with caching
RUN --mount=type=cache,id=s/<service-id>-/root/.cache/pnpm,target=/root/.cache/pnpm \
  NODE_ENV=production pnpm run build

#
# PRODUCTION STAGE
#
FROM base

RUN corepack enable

WORKDIR /app

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x entrypoint.sh

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# Need package.json to specify PNPM version which Corepack installs
COPY --from=build /app/package.json ./package.json
# Copy Drizzle config so we can migrate prior to building
COPY --from=build /app/src/lib/server/db/schema.ts /app/src/lib/server/db/schema.ts
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Expose the port the app runs on
EXPOSE 3000

# Entrypoint with db migration
ENTRYPOINT [ "/app/entrypoint.sh" ]
CMD ["node", "build/index.js"]
