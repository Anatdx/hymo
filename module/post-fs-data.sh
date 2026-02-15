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

# Load HymoFS LKM (GET_FD via SYS_reboot; LKM also hooks __arm64_sys_reboot for 5.10 compat. hymo_syscall_nr only used for ni_syscall path.)
if [ -f "$MODDIR/hymofs_lkm.ko" ]; then
    HYMO_SYSCALL_NR=142
    if insmod "$MODDIR/hymofs_lkm.ko" hymo_syscall_nr="$HYMO_SYSCALL_NR" 2>/dev/null; then
        log "post-fs-data: HymoFS LKM loaded (hymo_syscall_nr=$HYMO_SYSCALL_NR)"
        sleep 1.5
    else
        log "post-fs-data: HymoFS LKM insmod failed (may already be loaded or kernel mismatch)"
    fi
fi
exit 0
