#!/usr/bin/env bash
# Convenience wrapper to run the simulator from the CLI (optional — use the web UI instead)
# Usage:
#   ./run.sh                  -> open web UI instructions
#   ./run.sh <customer-folder> -> run simulation for that customer folder name

set -e

if [ -z "$1" ]; then
  echo "HyperStore Expansion Simulator"
  echo ""
  echo "  Web UI:  docker compose up  ->  open http://localhost:3000"
  echo ""
  echo "  CLI run: ./run.sh <customer-folder-name>"
  echo "  Example: ./run.sh move-03-03-2026"
  exit 0
fi

CUSTOMER="$1"

docker compose run --rm \
  -e DATA_DIR=/data \
  app \
  python3 /app/run_customer.py "$CUSTOMER" "cli-run-$(date +%s)" "/data/customers/$CUSTOMER/output/cli-$(date +%s)"
