#!/system/bin/sh
# Shared mount runner for stage scripts (directly executes hymod)

run_hymod_mount() {
    MODDIR="$1"
    STAGE="$2"

    BASE_DIR="/data/adb/hymo"
    LOG_FILE="$BASE_DIR/daemon.log"
    BOOT_COUNT_FILE="$BASE_DIR/boot_count"
    MOUNT_DONE_FLAG="$BASE_DIR/.mount_done"

    SINGLE_INSTANCE_LOCK="/dev/hymo_single_instance"
    LOCK_DIR="$BASE_DIR/.mount_lock"

    log() {
        local ts
        ts="$(date '+%Y-%m-%d %H:%M:%S')"
        echo "[$ts] [Wrapper] $1" >> "$LOG_FILE"
    }

    mkdir -p "$BASE_DIR"

    # single instance guard (mountify-style)
    if ! mkdir "$SINGLE_INSTANCE_LOCK" 2>/dev/null; then
        log "Already ran this boot, skipping"
        return 0
    fi

    # prevent concurrent mounts
    if ! mkdir "$LOCK_DIR" 2>/dev/null; then
        log "Mount already in progress, skipping"
        return 0
    fi
    trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT

    # already mounted this boot
    if [ -f "$MOUNT_DONE_FLAG" ]; then
        log "Already mounted this boot, skipping"
        return 0
    fi

    # clean previous log on boot (only if not already cleaned)
    if [ ! -f "$BASE_DIR/.log_cleaned" ]; then
        if [ -f "$LOG_FILE" ]; then
            rm "$LOG_FILE"
        fi
        touch "$BASE_DIR/.log_cleaned"
    fi

    # Anti-Bootloop Protection
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
            return 1
        fi

        echo "$BOOT_COUNT" > "$BOOT_COUNT_FILE"
        log "Boot count: $BOOT_COUNT (will reset on successful boot)"
    fi

    log "Starting Hymo mount (stage: $STAGE)..."

    if [ ! -f "$MODDIR/hymod" ]; then
        log "ERROR: Binary not found"
        return 1
    fi

    chmod 755 "$MODDIR/hymod"

    log "Executing hymod mount"
    "$MODDIR/hymod" mount >> "$LOG_FILE" 2>&1
    EXIT_CODE=$?

    log "Hymo exited with code $EXIT_CODE"

    if [ "$EXIT_CODE" = "0" ]; then
        touch "$MOUNT_DONE_FLAG"
        /data/adb/ksud kernel notify-module-mounted 2>/dev/null || true
    fi

    return "$EXIT_CODE"
}
