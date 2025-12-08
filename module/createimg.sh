#!/system/bin/sh
# Usage: createimg.sh [base_dir] [size_mb]

BASE_DIR=${1:-"/data/adb/hymo"}
IMG_SIZE_MB=${2:-2048}
IMG_FILE="$BASE_DIR/modules.img"

log_print() {
    echo "$1"
    if command -v ui_print >/dev/null 2>&1; then
        ui_print "$1"
    fi
}

log_print "- Creating ${IMG_SIZE_MB}MB ext4 image at $IMG_FILE..."

# Ensure directory exists
mkdir -p "$BASE_DIR"

truncate -s ${IMG_SIZE_MB}M "$IMG_FILE"

# [Stealth Update] Remove journal to prevent creating jbd2 sysfs node/threads
if [ -f "/system/bin/mke2fs" ]; then
    /system/bin/mke2fs -t ext4 -O ^has_journal -F "$IMG_FILE" >/dev/null 2>&1
    RET=$?
else
    log_print "! mke2fs not found"
    RET=1
fi

if [ $RET -ne 0 ]; then
    log_print "! Failed to format ext4 image"
    rm -f "$IMG_FILE"
    exit 1
else
    log_print "- Image created successfully"
    exit 0
fi
