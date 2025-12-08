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

# Install createimg.sh
cp "$MODPATH/createimg.sh" "$BASE_DIR/createimg.sh"
chmod 755 "$BASE_DIR/createimg.sh"

# Handle Config
if [ ! -f "$BASE_DIR/config.toml" ]; then
  ui_print "- Installing default config"
  cat "$MODPATH/config.toml" > "$BASE_DIR/config.toml"
fi

# Handle Image Creation (Borrowed from meta-overlayfs)
IMG_FILE="$BASE_DIR/modules.img"
IMG_SIZE_MB=2048

# Check if force_ext4 is enabled in config
FORCE_EXT4=false
if [ -f "$BASE_DIR/config.toml" ]; then
    if grep -q "force_ext4 = true" "$BASE_DIR/config.toml"; then
        FORCE_EXT4=true
        ui_print "- Force Ext4 mode enabled in config"
    fi
fi

if [ ! -f "$IMG_FILE" ]; then
    # Check if kernel supports tmpfs
    if grep -q "tmpfs" /proc/filesystems && [ "$FORCE_EXT4" = false ]; then
        ui_print "- Kernel supports tmpfs. Skipping ext4 image creation."
    else
        if [ "$FORCE_EXT4" = true ]; then
             ui_print "- Creating 2GB ext4 image (Forced Mode)..."
        else
             ui_print "- Creating 2GB ext4 image for module storage..."
        fi
        
        sh "$BASE_DIR/createimg.sh" "$BASE_DIR" "$IMG_SIZE_MB"
        
        if [ $? -ne 0 ]; then
            ui_print "! Failed to format ext4 image"
        fi
    fi
else
    ui_print "- Reusing existing modules.img"
fi

ui_print "- Installation complete"