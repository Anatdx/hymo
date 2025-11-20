#!/system/bin/sh
############################################
# meta-mm metainstall.sh
############################################

export KSU_HAS_METAMODULE="true"
export KSU_METAMODULE="meta-mm"

# Main installation flow
ui_print "- Using meta-mm metainstall"

# undo_handle_partition
# because ksu moves them e.g. MODDIR/system/product to MODDIR/product
# this way we can support normal hierarchy that ksu breaks
undo_handle_partition() {
	partition_to_undo="$1"
	if [ -L "$MODPATH/system/$partition_to_undo" ] && [ -d "$MODPATH/$partition_to_undo" ]; then
		# ui_print "- undo handle_partition for /$partition_to_undo"
		rm -f "$MODPATH/system/$partition_to_undo"
		mv -f "$MODPATH/$partition_to_undo" "$MODPATH/system/$partition_to_undo"
	fi
}

# call install function, this is important!
install_module

# Run for typical partitions
undo_handle_partition vendor
undo_handle_partition product
undo_handle_partition system_ext
undo_handle_partition odm

ui_print "- Installation complete"
