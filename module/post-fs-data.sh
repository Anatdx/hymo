#!/system/bin/sh
# Hymo post-fs-data.sh
# Mount stage: earliest (before most services start)

MODDIR="${0%/*}"
CONFIG_FILE="/data/adb/hymo/config.json"

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

if [ "$MOUNT_STAGE" = "post-fs-data" ]; then
    exec "$MODDIR/hymo_mount.sh" "post-fs-data"
fi

# Not our turn, exit silently
exit 0
