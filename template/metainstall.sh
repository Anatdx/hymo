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

ui_print "- Installation complete"
