#!/bin/sh

# Helper function to read secret from file if *_FILE env var is set
read_secret() {
  _var_name="$1"
  _file_var="${_var_name}_FILE"
  _file_path=$(eval echo \$"$_file_var")

  if [ -n "$_file_path" ] && [ -f "$_file_path" ]; then
    cat "$_file_path"
  else
    # Fallback to direct env var if *_FILE not set
    eval echo \$"$_var_name"
  fi
}

echo "Waiting for PostgreSQL to become available..."
# Wait for postgres to be ready

until nc -z -v -w30 "$POSTGRES_HOST" 5432; do
  echo "Still waiting for postgres..."
  sleep 1
done

echo "PostgreSQL is available. Running migrations..."
# Run migrations (uses POSTGRES_*_FILE env vars from drizzle.config.ts)

pnpm db:migrate

# Export all secrets as environment variables for runtime
# These are read by the app via $env/dynamic/private (not baked into build)
# Respects *_FILE env vars for all secrets (same pattern as drizzle.config.ts)
echo "Loading runtime configuration from Docker secrets..."

# Read all secrets using *_FILE pattern
POSTGRES_USER=$(read_secret POSTGRES_USER)
POSTGRES_PASSWORD=$(read_secret POSTGRES_PASSWORD)
POSTGRES_DB=$(read_secret POSTGRES_DB)

# Construct database URL
export PRIVATE_DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:5432/${POSTGRES_DB}"

# Application secrets
PRIVATE_DM_TOKEN="$(read_secret DM_TOKEN)"
IMGPROXY_KEY="$(read_secret IMGPROXY_KEY)"
IMGPROXY_SALT="$(read_secret IMGPROXY_SALT)"
IMGPROXY_URL="$(read_secret IMGPROXY_URL)"

export PRIVATE_DM_TOKEN
export IMGPROXY_KEY
export IMGPROXY_SALT
export IMGPROXY_URL

# Start the main application
echo "Starting the application..."
exec "$@"
