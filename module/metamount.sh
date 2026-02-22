#!/system/bin/sh
# Hymo metamount.sh: single script for mount (no shared common)
# hymod writes to daemon.log; wrapper also logs boot marker and stderr for debugging.

MODDIR="${0%/*}"
BASE_DIR="/data/adb/hymo"
LOG_FILE="$BASE_DIR/daemon.log"
BOOT_COUNT_FILE="$BASE_DIR/boot_count"

mkdir -p "$BASE_DIR"

# Boot marker: always append so we have trace even when hymod fails before Logger::init
echo "[$(date '+%Y-%m-%d %H:%M:%S')] [METAMOUNT] === Hymo mount started ===" >> "$LOG_FILE"

# Clean log once per boot (keep only this boot's content)
if [ ! -f "$BASE_DIR/.log_cleaned" ]; then
    [ -f "$LOG_FILE" ] && rm "$LOG_FILE"
    touch "$BASE_DIR/.log_cleaned"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [METAMOUNT] === Hymo mount started (fresh log) ===" >> "$LOG_FILE"
fi

# Anti-bootloop
if [ ! -f "$BASE_DIR/skip_bootloop_check" ]; then
    BOOT_COUNT=0
    [ -f "$BOOT_COUNT_FILE" ] && BOOT_COUNT=$(cat "$BOOT_COUNT_FILE" 2>/dev/null)
    BOOT_COUNT=$((BOOT_COUNT + 1))
    if [ "$BOOT_COUNT" -gt 2 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] [METAMOUNT] ERROR: Anti-bootloop triggered (boot_count=$BOOT_COUNT). Module disabled." >> "$LOG_FILE"
        touch "$MODDIR/disable"
        echo "0" > "$BOOT_COUNT_FILE"
        sed -i 's/^description=.*/description=[DISABLED] Anti-bootloop. Remove disable to re-enable./' "$MODDIR/module.prop"
        exit 1
    fi
    echo "$BOOT_COUNT" > "$BOOT_COUNT_FILE"
fi

if [ ! -f "$MODDIR/hymod" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [METAMOUNT] ERROR: hymod binary not found at $MODDIR/hymod" >> "$LOG_FILE"
    exit 1
fi
chmod 755 "$MODDIR/hymod"

# LKM is loaded in post-fs-data.sh; per KernelSU docs metamount runs after all post-fs-data.
# Redirect stderr to log so we capture errors before hymod's Logger::init (e.g. crash, config parse fail)
timeout 30 "$MODDIR/hymod" mount 2>> "$LOG_FILE"
EXIT_CODE=$?
if [ "$EXIT_CODE" = "124" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [METAMOUNT] ERROR: hymod mount timed out (30s)" >> "$LOG_FILE"
    EXIT_CODE=1
elif [ "$EXIT_CODE" != "0" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [METAMOUNT] ERROR: hymod mount exited with code $EXIT_CODE" >> "$LOG_FILE"
fi

if [ "$EXIT_CODE" = "0" ]; then
    /data/adb/ksud kernel notify-module-mounted 2>/dev/null || true
fi
exit "$EXIT_CODE"
