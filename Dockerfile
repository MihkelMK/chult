# Use this image as the platform to build the app
FROM node:20 AS build

# The WORKDIR instruction sets the working directory for everything that will happen next
WORKDIR /app

# Install packages
RUN yarn global add pnpm

COPY package.json .
RUN pnpm i

COPY . .

RUN pnpm build


FROM node:20

# https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#apt-get
# Don't install recommended packages as a sensible default, try removing if something breaks
# Only pin versions if this exploit depends on them. Generally they are a maintenence headache
RUN apt-get update && apt-get install -y --no-install-recommends \
  netcat-openbsd \
  && rm -rf /var/lib/apt/lists/* # Remove cache for smaller image

WORKDIR /app

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x entrypoint.sh

COPY --from=build /app/build /app/build
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/drizzle.config.ts /app/drizzle.config.ts
COPY --from=build /app/src/lib/server/db/schema.ts /app/src/lib/server/db/schema.ts
COPY --from=build /app/drizzle /app/drizzle

RUN npm install --omit=dev --legacy-peer-deps

ENTRYPOINT [ "entrypoint.sh" ]
CMD ["node", "build/index.js"]
