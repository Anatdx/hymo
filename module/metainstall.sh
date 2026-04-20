#!/system/bin/sh
############################################
# hymo metainstall.sh
# Installation hook for regular modules
############################################

# Tell KernelSU that the active metamodule is hymo.
export KSU_HAS_METAMODULE="true"
export KSU_METAMODULE="hymo"

BUILTIN_PARTITIONS="system vendor product system_ext odm oem"

# No-op KernelSU's default partition handling so Hymo is the only mount backend.
handle_partition() {
    echo 0 >/dev/null
    true
}

hymo_handle_partition() {
    partition="$1"

    if [ ! -d "$MODPATH/system/$partition" ]; then
        return 0
    fi

    if [ -L "/system/$partition" ] && [ -d "/$partition" ]; then
        ln -sfn "./system/$partition" "$MODPATH/$partition"
        ui_print "- Handled /$partition"
    fi
}

cleanup_empty_system_dir() {
    if [ -d "$MODPATH/system" ] && [ -z "$(ls -A "$MODPATH/system" 2>/dev/null)" ]; then
        rmdir "$MODPATH/system" 2>/dev/null
        ui_print "- Removed empty /system directory"
    fi
}

mark_replace() {
    replace_target="$1"
    mkdir -p "$replace_target"
    setfattr -n trusted.overlay.opaque -v y "$replace_target"
}

ui_print "- Using Hymo metainstall"

# This extracts the regular module into $MODPATH.
install_module

for partition in $BUILTIN_PARTITIONS; do
    hymo_handle_partition "$partition"
done

cleanup_empty_system_dir

ui_print "- Installation complete"
