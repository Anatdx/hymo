#!/system/bin/sh

# LKM subfolder: module/lkm/ contains androidXX-X.XX_hymofs_lkm.ko for each KMI.
# On install: detect device KMI, keep only matching LKM, clear others to save space.
LKM_DIR="$MODPATH/lkm"
if [ -d "$LKM_DIR" ]; then
  ui_print "- Detecting kernel version (KMI)..."
  UNAME=$(uname -r 2>/dev/null || echo "")
  KMI=""
  if echo "$UNAME" | grep -qE 'android[0-9]+'; then
    ANDROID=$(echo "$UNAME" | grep -oE 'android[0-9]+')
    KVER=$(echo "$UNAME" | grep -oE '^[0-9]+\.[0-9]+')
    KMI="${ANDROID}-${KVER}"
  fi
  if [ -n "$KMI" ] && [ -f "$LKM_DIR/${KMI}_hymofs_lkm.ko" ]; then
    ui_print "- Keeping LKM for $KMI, removing other versions..."
    cp "$LKM_DIR/${KMI}_hymofs_lkm.ko" "$MODPATH/hymofs_lkm.ko"
  else
    ui_print "- Trying first available LKM (KMI $KMI not found)..."
    FIRST_KO=$(ls "$LKM_DIR"/*.ko 2>/dev/null | head -n1)
    if [ -n "$FIRST_KO" ] && [ -f "$FIRST_KO" ]; then
      cp "$FIRST_KO" "$MODPATH/hymofs_lkm.ko"
    fi
  fi
  rm -rf "$LKM_DIR"
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

# Check if force_ext4 is enabled in config 
if [ -f "$BASE_DIR/config.json" ]; then
    if grep -q "\"fs_type\": \"ext4\"" "$BASE_DIR/config.json"; then
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