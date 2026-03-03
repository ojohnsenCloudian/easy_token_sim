#!/bin/sh
set -e

mkdir -p /data

# Seed a fresh empty database on first start
if [ ! -f /data/db.sqlite ]; then
  cp /app/initial.db /data/db.sqlite
fi

exec node server.js
