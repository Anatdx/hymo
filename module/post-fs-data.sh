#!/system/bin/sh
# Hymo post-fs-data.sh: load HymoFS LKM only. Mount runs in metamount.sh.
# LKM is embedded in hymod; use hymod lkm load to extract and load.

MODDIR="${0%/*}"
BASE_DIR="/data/adb/hymo"

mkdir -p "$BASE_DIR"

exit 0
