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

# Remove existing file to ensure clean state
rm -f "$IMG_FILE"

# Create empty file first to set attributes
touch "$IMG_FILE"

# Disable F2FS compression (if supported) as it causes issues with loop devices
# chattr -c (remove compression)
if command -v chattr >/dev/null 2>&1; then
    chattr -c "$IMG_FILE" >/dev/null 2>&1 || true
fi

# Use dd instead of truncate for better compatibility and to avoid sparse file issues
# This is critical for F2FS on some devices (OnePlus/Oppo) where sparse loop devices fail
dd if=/dev/zero of="$IMG_FILE" bs=1M count=$IMG_SIZE_MB
if [ $? -ne 0 ]; then
    log_print "! Failed to create image file with dd"
    rm -f "$IMG_FILE"
    exit 1
fi

# Find mke2fs
MKE2FS=""
if [ -x "/system/bin/mke2fs" ]; then
    MKE2FS="/system/bin/mke2fs"
elif [ -x "/sbin/mke2fs" ]; then
    MKE2FS="/sbin/mke2fs"
elif command -v mke2fs >/dev/null 2>&1; then
    MKE2FS=$(command -v mke2fs)
fi

if [ -z "$MKE2FS" ]; then
    log_print "! mke2fs not found"
    rm -f "$IMG_FILE"
    exit 1
fi

# Format
# Remove journal to prevent creating jbd2 sysfs node/threads
# Also disable metadata_csum and 64bit for better compatibility with older kernels
$MKE2FS -t ext4 -O ^has_journal,^metadata_csum,^64bit -F "$IMG_FILE" >/dev/null 2>&1
RET=$?

if [ $RET -ne 0 ]; then
    log_print "! Failed to format ext4 image"
    rm -f "$IMG_FILE"
    exit 1
else
    log_print "- Image created successfully"
    sync
    exit 0
fi
