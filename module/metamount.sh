#!/system/bin/sh
# Hymo metamount.sh: single script for mount (no shared common)

MODDIR="${0%/*}"
BASE_DIR="/data/adb/hymo"
LOG_FILE="$BASE_DIR/daemon.log"
BOOT_COUNT_FILE="$BASE_DIR/boot_count"
MOUNT_DONE_FLAG="$BASE_DIR/.mount_done"
SINGLE_INSTANCE_LOCK="/dev/hymo_single_instance"
LOCK_DIR="$BASE_DIR/.mount_lock"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Wrapper] $1" >> "$LOG_FILE"
}

mkdir -p "$BASE_DIR"

# Single instance (this boot)
if ! mkdir "$SINGLE_INSTANCE_LOCK" 2>/dev/null; then
    log "metamount: already ran this boot, skipping"
    exit 0
fi

# Concurrent guard
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
    log "metamount: mount in progress, skipping"
    exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null' EXIT

if [ -f "$MOUNT_DONE_FLAG" ]; then
    log "metamount: already mounted this boot, skipping"
    exit 0
fi

# Clean log once per boot
if [ ! -f "$BASE_DIR/.log_cleaned" ]; then
    [ -f "$LOG_FILE" ] && rm "$LOG_FILE"
    touch "$BASE_DIR/.log_cleaned"
fi

# Anti-bootloop
if [ ! -f "$BASE_DIR/skip_bootloop_check" ]; then
    BOOT_COUNT=0
    [ -f "$BOOT_COUNT_FILE" ] && BOOT_COUNT=$(cat "$BOOT_COUNT_FILE" 2>/dev/null)
    BOOT_COUNT=$((BOOT_COUNT + 1))
    if [ "$BOOT_COUNT" -gt 2 ]; then
        log "metamount: anti-bootloop (count=$BOOT_COUNT), disabling module"
        touch "$MODDIR/disable"
        echo "0" > "$BOOT_COUNT_FILE"
        sed -i 's/^description=.*/description=[DISABLED] Anti-bootloop. Remove disable to re-enable./' "$MODDIR/module.prop"
        exit 1
    fi
    echo "$BOOT_COUNT" > "$BOOT_COUNT_FILE"
fi

if [ ! -f "$MODDIR/hymod" ]; then
    log "metamount: hymod not found"
    exit 1
fi
chmod 755 "$MODDIR/hymod"

# Load HymoFS LKM before hymod (in case metamount runs before post-fs-data)
if [ -f "$MODDIR/hymofs_lkm.ko" ]; then
    HYMO_SYSCALL_NR=142
    if insmod "$MODDIR/hymofs_lkm.ko" hymo_syscall_nr="$HYMO_SYSCALL_NR" 2>/dev/null; then
        log "metamount: HymoFS LKM loaded (hymo_syscall_nr=$HYMO_SYSCALL_NR)"
    fi
fi

log "metamount: running hymod mount"
"$MODDIR/hymod" mount >> "$LOG_FILE" 2>&1
EXIT_CODE=$?
log "metamount: hymod exit $EXIT_CODE"

if [ "$EXIT_CODE" = "0" ]; then
    touch "$MOUNT_DONE_FLAG"
    /data/adb/ksud kernel notify-module-mounted 2>/dev/null || true
fi
exit "$EXIT_CODE"
