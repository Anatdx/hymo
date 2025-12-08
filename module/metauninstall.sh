#!/system/bin/sh
BASE_DIR="/data/adb/hymo"
STATE_FILE="$BASE_DIR/daemon_state.json"
MNT_DIR="/dev/hymo_mirror"

if [ -f "$STATE_FILE" ]; then
    READ_MNT=$(grep "mount_point" "$STATE_FILE" | cut -d'"' -f4)
    if [ ! -z "$READ_MNT" ]; then
        MNT_DIR="$READ_MNT"
    fi
fi

if [ -z "$MODULE_ID" ]; then
    exit 0
fi

if ! mountpoint -q "$MNT_DIR" 2>/dev/null; then
    exit 0
fi

MOD_IMG_DIR="$MNT_DIR/$MODULE_ID"
if [ -d "$MOD_IMG_DIR" ]; then
    rm -rf "$MOD_IMG_DIR"
fi

exit 0