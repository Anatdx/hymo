#!/system/bin/sh
############################################
# mm-mm uninstall.sh
# Cleanup script for metamodule removal
############################################

MODDIR="${0%/*}"

rm -rf /data/adb/mm.log
rm -rf /data/adb/mm.log.bak

exit 0
