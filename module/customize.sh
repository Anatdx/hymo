#!/system/bin/sh

# LKM selection at install: pick matching KMI, copy to hymofs_lkm.ko, remove others
LKM_DIR="$MODPATH/lkm"
if [ -d "$LKM_DIR" ]; then
    ui_print "- Detecting kernel KMI..."
    # Use /proc to avoid uname spoofing; only match X.Y.Z-androidN-xxx format (no patch in KMI)
    UNAME=$(cat /proc/sys/kernel/osrelease 2>/dev/null || echo "")
    KMI=""
    if echo "$UNAME" | grep -qE '^[0-9]+\.[0-9]+(\.[0-9]+)?-android[0-9]+'; then
        KVER=$(echo "$UNAME" | grep -oE '^[0-9]+\.[0-9]+')
        ANDROID=$(echo "$UNAME" | grep -oE 'android[0-9]+')
        KMI="${ANDROID}-${KVER}"
    fi
    if [ -n "$KMI" ] && [ -f "$LKM_DIR/${KMI}_hymofs_lkm.ko" ]; then
        cp "$LKM_DIR/${KMI}_hymofs_lkm.ko" "$MODPATH/hymofs_lkm.ko"
        ui_print "- Selected LKM: ${KMI}_hymofs_lkm.ko"
        ui_print "- Cleaning unused LKMs..."
        rm -rf "$LKM_DIR"
    else
        FIRST_KO=$(ls "$LKM_DIR"/*_hymofs_lkm.ko 2>/dev/null | head -1)
        if [ -n "$FIRST_KO" ]; then
            cp "$FIRST_KO" "$MODPATH/hymofs_lkm.ko"
            ui_print "- Using LKM: $(basename "$FIRST_KO") (no KMI match for $UNAME)"
            rm -rf "$LKM_DIR"
        else
            ui_print "- No matching LKM for KMI '$KMI' (uname: $UNAME); keeping lkm/ for fallback"
        fi
    fi
fi

ui_print "- Detecting device architecture..."

# Detect architecture using ro.product.cpu.abi
ABI=$(grep_get_prop ro.product.cpu.abi)
ui_print "- Detected ABI: $ABI"

# Select appropriate binary based on ABI
case "$ABI" in
    arm64-v8a)
        BINARY_NAME="hymod-arm64-v8a"
        ;;
    armeabi-v7a|armeabi)
        BINARY_NAME="hymod-armeabi-v7a"
        ;;
    x86_64)
        BINARY_NAME="hymod-x86_64"
        ;;
    *)
        abort "! Unsupported architecture: $ABI"
        ;;
esac

ui_print "- Selected binary: $BINARY_NAME"

# Verify binary exists
if [ ! -f "$MODPATH/$BINARY_NAME" ]; then
    abort "! Binary not found: $BINARY_NAME"
fi

# Copy selected binary to standard name
cp "$MODPATH/$BINARY_NAME" "$MODPATH/hymod"

# Set permissions for the selected binary
chmod 755 "$MODPATH/hymod"

# Remove unused architecture binaries to save space
ui_print "- Cleaning unused binaries..."
for binary in hymod-arm64-v8a hymod-armeabi-v7a hymod-x86_64; do
    rm -f "$MODPATH/$binary"
    ui_print "  Removed: $binary"
done

# Create symlink in KSU/APatch bin so hymod is in PATH
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
  # Generate default config using hymod
  $MODPATH/hymod config gen -o "$BASE_DIR/config.json"
fi

# Handle Image Creation (Borrowed from meta-overlayfs)
IMG_FILE="$BASE_DIR/modules.img"
IMG_SIZE_MB=2048


if [ ! -f "$IMG_FILE" ]; then
    # Check if kernel supports tmpfs
    if grep -q "tmpfs" /proc/filesystems ; then
        ui_print "- Kernel supports tmpfs. Skipping ext4 image creation."
    else
        ui_print "- Creating 2GB ext4 image for module storage..."
         # Use hymod to create image
        $MODPATH/hymod config create-image "$BASE_DIR"
        
        if [ $? -ne 0 ]; then
            ui_print "! Failed to format ext4 image"
        fi
    fi
else
    ui_print "- Reusing existing modules.img"
fi

ui_print "- Installation complete"