#!/system/bin/sh
############################################
# hymo metainstall.sh
############################################

# This tells KernelSU it's a metamodule
export KSU_HAS_METAMODULE="true"
export KSU_METAMODULE="hymo"

# Constants
BASE_DIR="/data/adb/hymo"

# 1. The installation process
ui_print "- Using Hymo metainstall"

# Standard installation (extracts to /data/adb/modules/hymo)
install_module

ui_print "- Installation complete"