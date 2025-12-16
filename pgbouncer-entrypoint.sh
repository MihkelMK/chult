#!/bin/sh

set -e

# Read the secret file paths from env vars passed by compose.
# Export the contents as the env vars the pgbouncer image expects (DB_USER, etc.)
if [ -n "$DB_USER_FILE" ] && [ -f "$DB_USER_FILE" ]; then
  DB_USER=$(cat "$DB_USER_FILE")
  export DB_USER
fi

if [ -n "$DB_PASSWORD_FILE" ] && [ -f "$DB_PASSWORD_FILE" ]; then
  DB_PASSWORD=$(cat "$DB_PASSWORD_FILE")
  export DB_PASSWORD
fi

if [ -n "$DB_NAME_FILE" ] && [ -f "$DB_NAME_FILE" ]; then
  DB_NAME=$(cat "$DB_NAME_FILE")
  export DB_NAME
fi

# Execute the original entrypoint. It will pick up the DB_* variables.
# If no arguments passed, use the default CMD from the image
if [ $# -eq 0 ]; then
  exec /entrypoint.sh /usr/bin/pgbouncer /etc/pgbouncer/pgbouncer.ini
else
  exec /entrypoint.sh "$@"
fi
