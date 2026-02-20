#!/bin/bash
# Build hymo-minimal for Android NDK
# - lib: target/<triple>/release/libhymo_minimal.a
# - bin: target/<triple>/release/hymod (daemon)

set -e
cd "$(dirname "$0")"

# Find NDK for strip (optional)
if [ -z "$ANDROID_NDK" ] || [ ! -d "$ANDROID_NDK" ]; then
    for base in "$HOME/Library/Android/sdk/ndk" "$HOME/Android/Sdk/ndk"; do
        if [ -d "$base" ]; then
            ANDROID_NDK=$(find "$base" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -V | tail -n 1)
            [ -n "$ANDROID_NDK" ] && break
        fi
    done
fi

rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android 2>/dev/null || true

cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 build --release --bin hymod

OUT="../build/out"
mkdir -p "$OUT"
cp target/aarch64-linux-android/release/hymod "$OUT/hymod-arm64-v8a"
cp target/armv7-linux-androideabi/release/hymod "$OUT/hymod-armeabi-v7a"
cp target/x86_64-linux-android/release/hymod "$OUT/hymod-x86_64"

# Strip with NDK llvm-strip
if [ -n "$ANDROID_NDK" ] && [ -d "$ANDROID_NDK" ]; then
    PREBUILT=$(find "$ANDROID_NDK/toolchains/llvm/prebuilt" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -1)
    if [ -n "$PREBUILT" ] && [ -f "$PREBUILT/bin/llvm-strip" ]; then
        "$PREBUILT/bin/llvm-strip" --strip-all "$OUT"/hymod-*
    fi
fi

chmod 755 "$OUT"/hymod-*

echo ""
echo "Built daemon: $OUT/hymod-{arm64-v8a,armeabi-v7a,x86_64}"
ls -la "$OUT"/hymod-*
