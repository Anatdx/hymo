#!/usr/bin/env sh

set -eu

PORT="${1:-4173}"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

echo "The React WebUI is no longer the primary frontend."
echo "Serving the new static WebUI from:"
echo "  ${ROOT_DIR}/module/webroot"
echo

exec "${ROOT_DIR}/module/webroot/preview.sh" "$PORT"
