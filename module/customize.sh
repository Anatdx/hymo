#!/system/bin/sh

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
    x86)
        BINARY_NAME="hymod-x86"
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
for binary in hymod-arm64-v8a hymod-armeabi-v7a hymod-x86_64 hymod-x86; do
    rm -f "$MODPATH/$binary"
    ui_print "  Removed: $binary"
done

# Base directory setup
BASE_DIR="/data/adb/hymo"
mkdir -p "$BASE_DIR"

# Handle Config
if [ ! -f "$BASE_DIR/config.toml" ]; then
  ui_print "- Installing default config"
  cat "$MODPATH/config.toml" > "$BASE_DIR/config.toml"
fi

# Handle Image Creation (Borrowed from meta-overlayfs)
IMG_FILE="$BASE_DIR/modules.img"
IMG_SIZE_MB=2048

if [ ! -f "$IMG_FILE" ]; then
    ui_print "- Creating 2GB ext4 image for module storage..."
    truncate -s ${IMG_SIZE_MB}M "$IMG_FILE"
    
    # [Stealth Update] Remove journal to prevent creating jbd2 sysfs node/threads
    /system/bin/mke2fs -t ext4 -O ^has_journal -F "$IMG_FILE" >/dev/null 2>&1
    
    if [ $? -ne 0 ]; then
        ui_print "! Failed to format ext4 image"
    else
        ui_print "- Image created successfully (No Journal Mode)"
    fi
else
    ui_print "- Reusing existing modules.img"
fi

ui_print "- Installation complete"