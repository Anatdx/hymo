#!/bin/bash
# Build hymo-minimal for Android NDK
# - lib: target/<triple>/release/libhymo_minimal.a
# - bin: target/<triple>/release/hymod (daemon)

set -e
cd "$(dirname "$0")"

rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android 2>/dev/null || true

cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 build --release --bin hymod

OUT="../build/out"
mkdir -p "$OUT"
cp target/aarch64-linux-android/release/hymod "$OUT/hymod-arm64-v8a"
cp target/armv7-linux-androideabi/release/hymod "$OUT/hymod-armeabi-v7a"
cp target/x86_64-linux-android/release/hymod "$OUT/hymod-x86_64"
chmod 755 "$OUT"/hymod-*

echo ""
echo "Built daemon: $OUT/hymod-{arm64-v8a,armeabi-v7a,x86_64}"
ls -la "$OUT"/hymod-*
