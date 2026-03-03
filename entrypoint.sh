#!/bin/sh
set -e

# Create the data directory if it doesn't exist (e.g. volume not mounted)
mkdir -p /data

# Apply all pending migrations, creating the SQLite db from scratch if needed
node node_modules/prisma/build/index.js migrate deploy --schema /app/webapp/prisma/schema.prisma

exec node server.js
