#!/bin/sh

echo "Waiting for PostgreSQL to become available..."
# Wait for postgres to be ready

until nc -z -v -w30 "$POSTGRES_HOST" 5432; do
  echo "Still waiting for postgres..."
  sleep 1
done

echo "PostgreSQL is available. Running migrations..."
# Run migrations (uses POSTGRES_*_FILE env vars from drizzle.config.ts)

pnpm db:migrate

# Construct PRIVATE_DATABASE_URL from Docker secrets for runtime
# This is read by the app via $env/dynamic/private at runtime
echo "Constructing database connection URL from secrets..."
export PRIVATE_DATABASE_URL="postgresql://$(cat /run/secrets/POSTGRES_USER):$(cat /run/secrets/POSTGRES_PASSWORD)@${POSTGRES_HOST}:5432/$(cat /run/secrets/POSTGRES_DB)"

# Start the main application
echo "Starting the application..."
exec "$@"
