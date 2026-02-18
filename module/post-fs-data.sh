#!/system/bin/sh
# Hymo post-fs-data.sh: load HymoFS LKM only. Mount runs in metamount.sh.

MODDIR="${0%/*}"
BASE_DIR="/data/adb/hymo"
LOG_FILE="$BASE_DIR/daemon.log"

log() {
    local ts
    ts="$(date '+%Y-%m-%d %H:%M:%S')"
    echo "[$ts] [Wrapper] $1" >> "$LOG_FILE"
}

mkdir -p "$BASE_DIR"

# LKM selected at install in customize.sh; just load hymofs_lkm.ko
if [ -f "$MODDIR/hymofs_lkm.ko" ]; then
    HYMO_SYSCALL_NR=142
    if insmod "$MODDIR/hymofs_lkm.ko" hymo_syscall_nr="$HYMO_SYSCALL_NR" 2>/dev/null; then
        log "post-fs-data: HymoFS LKM loaded (hymo_syscall_nr=$HYMO_SYSCALL_NR)"
    else
        log "post-fs-data: HymoFS LKM insmod failed (may already be loaded or kernel mismatch)"
    fi
fi
exit 0
