#!/system/bin/sh
# meta-overlayfs Module Mount Handler
# This script is the entry point for dual-directory module mounting

MODDIR="${0%/*}"

# Binary path (architecture-specific binary selected during installation)
BINARY="$MODDIR/meta-mm"

if [ ! -f "$BINARY" ]; then
    log "ERROR: Binary not found: $BINARY"
    exit 1
fi

# Set dual-directory environment variables
MODULE_METADATA_DIR="/data/adb/modules"
MODULE_METADATA_SOURCE="KSU"
MODULE_METADATA_LOGLEVEL=3
MODULE_METADATA_LOGFILE="/data/adb/mm.log"

if [ -f "$MODULE_METADATA_LOGFILE" ]; then
    mv "$MODULE_METADATA_LOGFILE" "$MODULE_METADATA_LOGFILE".old
fi

# Execute the mount binary
"$BINARY" -s "$MODULE_METADATA_SOURCE" -m "$MODULE_METADATA_DIR" -v "$MODULE_METADATA_LOGLEVEL" -l "$MODULE_METADATA_LOGFILE"

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    log "Mount failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
fi

log "Mount completed successfully"
exit 0
