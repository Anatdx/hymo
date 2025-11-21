#!/system/bin/sh
############################################
# meta-mm metainstall.sh
############################################

export KSU_HAS_METAMODULE="true"
export KSU_METAMODULE="meta-mm"

# Main installation flow
ui_print "- Using meta-mm metainstall"

# we no-op handle_partition
# this way we can support normal hierarchy that ksu changes
handle_partition() {
	echo 0 > /dev/null ; true
}

# call install function, this is important!
install_module

mm_handle_partition() {
	partition="$1"
	
	if [ ! -d "$MODPATH/system/$partition" ]; then
		return
	fi
	
	if [ -L "/system/$partition" ] && [ -d "/$partition" ]; then
		ui_print "- Handle partition /$partition"
		ln -sf "./system/$partition" "$MODPATH/$partition"
	fi
}

mm_handle_partition system_ext
mm_handle_partition vendor
mm_handle_partition product

ui_print "- Installation complete"
