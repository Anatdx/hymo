#!/system/bin/sh
# Hymo metamount.sh: single script for mount (no shared common)

MODDIR="${0%/*}"
BASE_DIR="/data/adb/hymo"
BOOT_COUNT_FILE="$BASE_DIR/boot_count"

mkdir -p "$BASE_DIR"

# Anti-bootloop
if [ ! -f "$BASE_DIR/skip_bootloop_check" ]; then
    BOOT_COUNT=0
    [ -f "$BOOT_COUNT_FILE" ] && BOOT_COUNT=$(cat "$BOOT_COUNT_FILE" 2>/dev/null)
    BOOT_COUNT=$((BOOT_COUNT + 1))
    if [ "$BOOT_COUNT" -gt 2 ]; then
        touch "$MODDIR/disable"
        echo "0" > "$BOOT_COUNT_FILE"
        sed -i 's/^description=.*/description=[DISABLED] Anti-bootloop. Remove disable to re-enable./' "$MODDIR/module.prop"
        exit 1
    fi
    echo "$BOOT_COUNT" > "$BOOT_COUNT_FILE"
fi

if [ ! -f "$MODDIR/hymod" ]; then
    exit 1
fi
chmod 755 "$MODDIR/hymod"

# LKM is loaded in post-fs-data.sh; per KernelSU docs metamount runs after all post-fs-data.
timeout 30 "$MODDIR/hymod" mount
EXIT_CODE=$?

if [ "$EXIT_CODE" = "0" ]; then
    /data/adb/ksud kernel notify-module-mounted 2>/dev/null || true
fi
exit "$EXIT_CODE"
