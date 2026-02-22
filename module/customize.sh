#!/system/bin/sh

# Volume key menu: Vol+ prev, Vol- next, Power confirm
# Returns selected index (0-based) via global MENU_SELECT
select_menu() {
    local items="$1"
    local count=0 idx=0 i f ev

    for i in $items; do count=$((count + 1)); done
    [ "$count" -eq 0 ] && return 1
    [ "$count" -eq 1 ] && { MENU_SELECT=0; return 0; }

    if ! command -v getevent >/dev/null 2>&1; then
        ui_print "- getevent not found, using first option"
        MENU_SELECT=0
        return 0
    fi

    idx=0
    while true; do
        i=0
        for f in $items; do
            if [ "$i" -eq "$idx" ]; then
                ui_print "  [*] $(basename "$f")"
            else
                ui_print "  [ ] $(basename "$f")"
            fi
            i=$((i + 1))
        done
        ui_print "- Vol+/-: browse  Power: confirm"
        ev=$(timeout 8 getevent -lqc 1 2>/dev/null)
        if echo "$ev" | grep -qi 'VOLUMEUP'; then
            idx=$((idx - 1))
            [ "$idx" -lt 0 ] && idx=$((count - 1))
        elif echo "$ev" | grep -qi 'VOLUMEDOWN'; then
            idx=$((idx + 1))
            [ "$idx" -ge "$count" ] && idx=0
        elif echo "$ev" | grep -qiE 'POWER|ENTER'; then
            MENU_SELECT=$idx
            return 0
        else
            ui_print "- Timeout, using first option"
            MENU_SELECT=0
            return 0
        fi
    done
}

# 1. ABI selection first
ui_print "- Detecting device architecture..."
ABI=$(grep_get_prop ro.product.cpu.abi 2>/dev/null || echo "")
case "$ABI" in
    arm64-v8a) ARCH_PREFIX="arm64" ;;
    armeabi-v7a|armeabi) ARCH_PREFIX="arm" ;;
    x86_64) ARCH_PREFIX="x86_64" ;;
    *)
        ui_print "- Unsupported ABI: $ABI"
        abort "! Unsupported architecture: $ABI"
        ;;
esac
ui_print "- Detected ABI: $ABI (arch: $ARCH_PREFIX)"

# Select hymod binary
case "$ABI" in
    arm64-v8a) BINARY_NAME="hymod-arm64-v8a" ;;
    armeabi-v7a|armeabi) BINARY_NAME="hymod-armeabi-v7a" ;;
    x86_64) BINARY_NAME="hymod-x86_64" ;;
esac
if [ ! -f "$MODPATH/$BINARY_NAME" ]; then
    abort "! Binary not found: $BINARY_NAME"
fi
cp "$MODPATH/$BINARY_NAME" "$MODPATH/hymod"
chmod 755 "$MODPATH/hymod"

# Remove unused binaries
ui_print "- Cleaning unused binaries..."
for binary in hymod-arm64-v8a hymod-armeabi-v7a hymod-x86_64; do
    rm -f "$MODPATH/$binary"
done

# Create symlink in KSU/APatch bin
HYMO_MODULE_PATH="/data/adb/modules/hymo"
for BIN_BASE in /data/adb/ksu /data/adb/ap; do
    if [ -d "$BIN_BASE" ]; then
        mkdir -p "$BIN_BASE/bin"
        ln -sf "$HYMO_MODULE_PATH/hymod" "$BIN_BASE/bin/hymod" 2>/dev/null && \
            ui_print "- Symlink: $BIN_BASE/bin/hymod -> $HYMO_MODULE_PATH/hymod"
    fi
done

# Base directory setup
BASE_DIR="/data/adb/hymo"
mkdir -p "$BASE_DIR"

# Handle Config
if [ ! -f "$BASE_DIR/config.json" ]; then
    ui_print "- Installing default config"
    $MODPATH/hymod config gen -o "$BASE_DIR/config.json"
fi

# Handle Image Creation
IMG_FILE="$BASE_DIR/modules.img"
if [ ! -f "$IMG_FILE" ]; then
    if grep -q "tmpfs" /proc/filesystems; then
        ui_print "- Kernel supports tmpfs. Skipping ext4 image creation."
    else
        ui_print "- Creating 2GB ext4 image for module storage..."
        $MODPATH/hymod config create-image "$BASE_DIR"
        [ $? -ne 0 ] && ui_print "! Failed to format ext4 image"
    fi
else
    ui_print "- Reusing existing modules.img"
fi

ui_print "- Installation complete"
