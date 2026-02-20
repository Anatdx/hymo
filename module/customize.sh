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

# 2. LKM selection (filter by arch, then KMI)
LKM_DIR="$MODPATH/lkm"
if [ -d "$LKM_DIR" ]; then
    ui_print "- Detecting kernel KMI..."
    UNAME=$(cat /proc/sys/kernel/osrelease 2>/dev/null || echo "")
    KMI=""
    if echo "$UNAME" | grep -qE '^[0-9]+\.[0-9]+(\.[0-9]+)?-android[0-9]+'; then
        KVER=$(echo "$UNAME" | grep -oE '^[0-9]+\.[0-9]+')
        ANDROID=$(echo "$UNAME" | grep -oE 'android[0-9]+')
        KMI="${ANDROID}-${KVER}"
    fi

    # Filter ko by arch prefix (e.g. arm64_*, arm_*, x86_64_*)
    KO_LIST=""
    for ko in "$LKM_DIR"/${ARCH_PREFIX}_*_hymofs_lkm.ko; do
        [ -f "$ko" ] && KO_LIST="$KO_LIST $ko"
    done

    SELECTED_KO=""
    if [ -n "$KMI" ]; then
        for ko in $KO_LIST; do
            if echo "$ko" | grep -q "${KMI}_hymofs_lkm"; then
                SELECTED_KO="$ko"
                break
            fi
        done
    fi

    if [ -n "$SELECTED_KO" ]; then
        cp "$SELECTED_KO" "$MODPATH/hymofs_lkm.ko"
        ui_print "- Selected LKM: $(basename "$SELECTED_KO")"
        rm -rf "$LKM_DIR"
    elif [ -n "$KO_LIST" ]; then
        ui_print "- No KMI match for $UNAME, please select manually:"
        if select_menu "$KO_LIST"; then
            idx=0
            for ko in $KO_LIST; do
                if [ "$idx" -eq "$MENU_SELECT" ]; then
                    cp "$ko" "$MODPATH/hymofs_lkm.ko"
                    ui_print "- Selected: $(basename "$ko")"
                    break
                fi
                idx=$((idx + 1))
            done
            rm -rf "$LKM_DIR"
        else
            FIRST_KO=$(echo "$KO_LIST" | awk '{print $1}')
            cp "$FIRST_KO" "$MODPATH/hymofs_lkm.ko"
            ui_print "- Using first available: $(basename "$FIRST_KO")"
            rm -rf "$LKM_DIR"
        fi
    else
        ui_print "- No LKM for arch $ARCH_PREFIX; keeping lkm/ for fallback"
    fi
fi

# Remove unused binaries
ui_print "- Cleaning unused binaries..."
for binary in hymod-arm64-v8a hymod-armeabi-v7a hymod-x86_64; do
    rm -f "$MODPATH/$binary"
done

# Create symlink in KSU/APatch bin
for BIN_BASE in /data/adb/ksu /data/adb/ap; do
    if [ -d "$BIN_BASE" ]; then
        mkdir -p "$BIN_BASE/bin"
        ln -sf $MODPATH/hymod "$BIN_BASE/bin/hymod" 2>/dev/null && \
            ui_print "- Symlink: $BIN_BASE/bin/hymod -> $MODPATH/hymod"
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
