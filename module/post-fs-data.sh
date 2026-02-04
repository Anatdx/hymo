#!/system/bin/sh
# Hymo post-fs-data.sh
# Mount stage: earliest (before most services start)

MODDIR="${0%/*}"
BASE_DIR="/data/adb/hymo"
LOG_FILE="$BASE_DIR/daemon.log"
CONFIG_FILE="$BASE_DIR/config.json"

log() {
    local ts
    ts="$(date '+%Y-%m-%d %H:%M:%S')"
    echo "[$ts] [Wrapper] $1" >> "$LOG_FILE"
}

# Get mount_stage from config
get_mount_stage() {
    if [ -f "$CONFIG_FILE" ]; then
        # Simple JSON parsing for mount_stage
        STAGE=$(grep -o '"mount_stage"[[:space:]]*:[[:space:]]*"[^"]*"' "$CONFIG_FILE" | sed 's/.*"\([^"]*\)"$/\1/')
        echo "${STAGE:-metamount}"
    else
        echo "metamount"
    fi
}

MOUNT_STAGE=$(get_mount_stage)

# Bootstrap KPM early: apply hook mask before later mount stage runs.
if [ -f "$MODDIR/hymod" ]; then
    chmod 755 "$MODDIR/hymod" 2>/dev/null || true
    log "post-fs-data: bootstrap HymoFS/KPM (mask)"
    # Some devices load KPMs slightly later; retry briefly to avoid -EINVAL timing flake.
    i=0
    while [ "$i" -lt 15 ]; do
        "$MODDIR/hymod" hymofs bootstrap >> "$LOG_FILE" 2>&1 && break
        i=$((i + 1))
        sleep 0.2
    done
    if [ "$i" -ge 15 ]; then
        log "post-fs-data: bootstrap failed (give up after retries)"
    fi
else
    log "post-fs-data: hymod not found, skip bootstrap"
fi

if [ "$MOUNT_STAGE" = "post-fs-data" ]; then
    log "post-fs-data: executing mount (stage=$MOUNT_STAGE)"
    if [ -f "$MODDIR/hymo_mount_common.sh" ]; then
        . "$MODDIR/hymo_mount_common.sh"
        run_hymod_mount "$MODDIR" "post-fs-data"
        exit $?
    fi
    log "post-fs-data: missing hymo_mount_common.sh"
    exit 1
fi

log "post-fs-data: skip (stage=$MOUNT_STAGE)"
exit 0
