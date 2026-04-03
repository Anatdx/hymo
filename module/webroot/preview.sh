#!/usr/bin/env sh

set -eu

PORT="${1:-4173}"
ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

echo "Serving static Hymo WebUI from:"
echo "  $ROOT_DIR"
echo
echo "Open in browser:"
echo "  http://127.0.0.1:${PORT}/"
echo "  http://127.0.0.1:${PORT}/?mock=1"
echo

if command -v python3 >/dev/null 2>&1; then
  cd "$ROOT_DIR"
  exec python3 -m http.server "$PORT"
fi

if command -v python >/dev/null 2>&1; then
  cd "$ROOT_DIR"
  exec python -m SimpleHTTPServer "$PORT"
fi

if command -v ruby >/dev/null 2>&1; then
  cd "$ROOT_DIR"
  exec ruby -run -e httpd . -p "$PORT"
fi

echo "No suitable static file server found (python3/python/ruby)." >&2
exit 1
