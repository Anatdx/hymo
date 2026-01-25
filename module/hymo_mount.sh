#!/system/bin/sh
# Hymo Mount Core Script
# This script contains the actual mount logic
# Called by post-fs-data.sh, metamount.sh, or services.sh based on mount_stage config

MODDIR="${0%/*}"
cd "$MODDIR"

BASE_DIR="/data/adb/hymo"
LOG_FILE="$BASE_DIR/daemon.log"
BOOT_COUNT_FILE="$BASE_DIR/boot_count"
CONFIG_FILE="$BASE_DIR/config.json"
MOUNT_DONE_FLAG="$BASE_DIR/.mount_done"

# Use argument or default to metamount
MOUNT_STAGE="${1:-metamount}"

# Ensure base directory exists
mkdir -p "$BASE_DIR"

log() {
    echo "[Hymo] $1" >> "$LOG_FILE"
}

# Check if already mounted this boot
if [ -f "$MOUNT_DONE_FLAG" ]; then
    log "Already mounted this boot, skipping"
    exit 0
fi

# Clean previous log on boot (only if not already cleaned)
if [ ! -f "$BASE_DIR/.log_cleaned" ]; then
    if [ -f "$LOG_FILE" ]; then
        rm "$LOG_FILE"
    fi
    touch "$BASE_DIR/.log_cleaned"
fi

# ============================================
# Anti-Bootloop Protection
# If the module causes bootloop, it will be disabled after 2 failed attempts
# To bypass: create /data/adb/hymo/skip_bootloop_check
# ============================================
if [ ! -f "$BASE_DIR/skip_bootloop_check" ]; then
    BOOT_COUNT=0
    if [ -f "$BOOT_COUNT_FILE" ]; then
        BOOT_COUNT=$(cat "$BOOT_COUNT_FILE" 2>/dev/null || echo "0")
    fi
    
    BOOT_COUNT=$((BOOT_COUNT + 1))
    
    if [ "$BOOT_COUNT" -gt 2 ]; then
        log "Anti-bootloop triggered! Boot count: $BOOT_COUNT"
        log "Module disabled. Remove $MODDIR/disable to re-enable."
        touch "$MODDIR/disable"
        echo "0" > "$BOOT_COUNT_FILE"
        # Update module description
        sed -i 's/^description=.*/description=[DISABLED] Anti-bootloop triggered. Remove disable file to re-enable./' "$MODDIR/module.prop"
        exit 1
    fi
    
    echo "$BOOT_COUNT" > "$BOOT_COUNT_FILE"
    log "Boot count: $BOOT_COUNT (will reset on successful boot)"
fi

log "Starting Hymo mount (stage: $MOUNT_STAGE)..."

if [ ! -f "hymod" ]; then
    log "ERROR: Binary not found"
    exit 1
fi

chmod 755 "hymod"

# Execute C++ Binary
"./hymod" mount
EXIT_CODE=$?

log "Hymo exited with code $EXIT_CODE"

# Mark as done and notify on success
if [ "$EXIT_CODE" = "0" ]; then
    touch "$MOUNT_DONE_FLAG"
    /data/adb/ksud kernel notify-module-mounted 2>/dev/null || true
    # Reset boot count on successful mount
    echo "0" > "$BOOT_COUNT_FILE"
    log "Mount successful, reset boot count"
fi

exit $EXIT_CODE
