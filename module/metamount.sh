#!/system/bin/sh
# Hymo Startup Script

MODDIR="${0%/*}"
cd "$MODDIR"

BASE_DIR="/data/adb/hymo"
LOG_FILE="$BASE_DIR/daemon.log"

# Ensure base directory exists
mkdir -p "$BASE_DIR"

# Clean previous log on boot
if [ -f "$LOG_FILE" ]; then
    rm "$LOG_FILE"
fi

log() {
    echo "[Wrapper] $1" >> "$LOG_FILE"
}

log "Starting Hymo..."

if [ ! -f "hymod" ]; then
    log "ERROR: Binary not found at hymo"
    exit 1
fi

chmod 755 "hymod"
log "Using binary: hymod"

# Execute C++ Binary
"./hymod" >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

log "Hymo exited with code $EXIT_CODE"

# 3. Notify KernelSU
if [ "$EXIT_CODE" = "0" ]; then
    /data/adb/ksud kernel notify-module-mounted
fi

exit $EXIT_CODE