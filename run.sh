#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-5173}"
HOST="${HOST:-127.0.0.1}"

echo "Starting Save the Grid at http://${HOST}:${PORT}"
exec python3 -m http.server "${PORT}" --bind "${HOST}"
