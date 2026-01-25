#!/system/bin/sh
# Hymo services.sh
# Mount stage: late (after boot completed)

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

if [ "$MOUNT_STAGE" = "services" ]; then
    exec "$MODDIR/hymo_mount.sh" "services"
fi

# Not our turn, exit silently
exit 0
