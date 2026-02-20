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

# LKM autoload: check /data/adb/hymo/lkm_autoload (default: load)
AUTOLOAD=1
[ -f "$BASE_DIR/lkm_autoload" ] && AUTOLOAD=$(cat "$BASE_DIR/lkm_autoload" 2>/dev/null | tr -d '\n\r')
[ "$AUTOLOAD" = "0" ] || [ "$AUTOLOAD" = "off" ] && AUTOLOAD=0
[ -z "$AUTOLOAD" ] && AUTOLOAD=1

# LKM selected at install in customize.sh; just load hymofs_lkm.ko
if [ "$AUTOLOAD" = "1" ] && [ -f "$MODDIR/hymofs_lkm.ko" ]; then
    HYMO_SYSCALL_NR=142
    if insmod "$MODDIR/hymofs_lkm.ko" hymo_syscall_nr="$HYMO_SYSCALL_NR" 2>/dev/null; then
        log "post-fs-data: HymoFS LKM loaded (hymo_syscall_nr=$HYMO_SYSCALL_NR)"
    else
        log "post-fs-data: HymoFS LKM insmod failed (may already be loaded or kernel mismatch)"
    fi
fi
exit 0
