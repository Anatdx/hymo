#!/system/bin/sh
############################################
# hymo uninstall.sh
# Cleanup script for metamodule removal
############################################

BASE_DIR="/data/adb/hymo"
STATE_FILE="$BASE_DIR/daemon_state.json"
MNT_DIR="/dev/hymo_mirror"

if [ -f "$STATE_FILE" ]; then
    READ_MNT=$(grep "mount_point" "$STATE_FILE" | cut -d'"' -f4)
    if [ ! -z "$READ_MNT" ]; then
        MNT_DIR="$READ_MNT"
    fi
fi

if mountpoint -q "$MNT_DIR"; then
    umount "$MNT_DIR" 2>/dev/null || umount -l "$MNT_DIR"
fi

rm -rf "$BASE_DIR"

exit 0