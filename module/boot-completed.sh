#!/system/bin/sh
# Hymo boot-completed.sh
# Clean up boot flags for next boot

BASE_DIR="/data/adb/hymo"

# Clean up mount done flag for next boot
rm -f "$BASE_DIR/.mount_done"
rm -f "$BASE_DIR/.log_cleaned"
