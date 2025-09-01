#!/bin/sh

echo "Waiting for PostgreSQL to become available..."
# Wait for postgres to be ready

until nc -z -v -w30 postgres 5432; do
  echo "Still waiting for postgres..."
  sleep 1
done

echo "PostgreSQL is available. Running migrations..."
#Run migrations

npm run db:migrate
#Start the main application

echo "Starting the application..."
exec "$@"
