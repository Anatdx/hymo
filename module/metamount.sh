#!/system/bin/sh
# Hymo metamount.sh: single script for mount (no shared common)

MODDIR="${0%/*}"
BASE_DIR="/data/adb/hymo"

mkdir -p "$BASE_DIR"

# LKM autoload: check /data/adb/hymo/lkm_autoload (default: load)
AUTOLOAD=1
[ -f "$BASE_DIR/lkm_autoload" ] && AUTOLOAD=$(cat "$BASE_DIR/lkm_autoload" 2>/dev/null | tr -d '\n\r')
[ "$AUTOLOAD" = "0" ] || [ "$AUTOLOAD" = "off" ] && AUTOLOAD=0
[ -z "$AUTOLOAD" ] && AUTOLOAD=1

# Load LKM via hymod (embedded in binary)
if [ "$AUTOLOAD" = "1" ] && [ -f "$MODDIR/hymod" ]; then
    "$MODDIR/hymod" lkm load 2>/dev/null || true
fi

echo "[$(date +%s)] metamount boot starting" >> "$BASE_DIR/daemon.log" 2>/dev/null || true
"$MODDIR/hymod" mount
EXIT_CODE=$?

if [ "$EXIT_CODE" = "0" ]; then
    /data/adb/ksud kernel notify-module-mounted 2>/dev/null || true
fi
exit "$EXIT_CODE"
