#!/system/bin/sh
# Hymo Startup Script

MODDIR="${0%/*}"
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

# Detect architecture and select correct binary
ARCH=$(uname -m)
case "$ARCH" in
    aarch64)
        BINARY="$MODDIR/hymo-arm64-v8a"
        ;;
    armv7l|armv8l)
        BINARY="$MODDIR/hymo-armeabi-v7a"
        ;;
    x86_64)
        BINARY="$MODDIR/hymo-x86_64"
        ;;
    i686|x86)
        BINARY="$MODDIR/hymo-x86"
        ;;
    *)
        log "ERROR: Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

if [ ! -f "$BINARY" ]; then
    log "ERROR: Binary not found at $BINARY"
    exit 1
fi

chmod 755 "$BINARY"

log "Using binary: $BINARY"

# Execute C++ Binary
"$BINARY" >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

log "Hymo exited with code $EXIT_CODE"

# 3. Notify KernelSU
if [ "$EXIT_CODE" = "0" ]; then
    /data/adb/ksud kernel notify-module-mounted
fi

exit $EXIT_CODE