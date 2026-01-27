#!/system/bin/sh
# Hymo boot-completed.sh
# Clean up boot flags for next boot

BASE_DIR="/data/adb/hymo"
LOG_FILE="$BASE_DIR/daemon.log"

log() {
    local ts
    ts="$(date '+%Y-%m-%d %H:%M:%S')"
    echo "[$ts] [Wrapper] $1" >> "$LOG_FILE"
}

# Clean up mount done flag for next boot
rm -f "$BASE_DIR/.mount_done"
rm -f "$BASE_DIR/.log_cleaned"
rm -rf /dev/hymo_single_instance

# Reset boot count only after a successful boot
if [ -f "$BASE_DIR/boot_count" ]; then
    echo "0" > "$BASE_DIR/boot_count"
    log "Boot completed, reset boot count"
fi
