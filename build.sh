#!/bin/bash
# Hymo Build Script - CMake + Ninja
# Usage: ./build.sh [target] [options]

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build"
OUT_DIR="${BUILD_DIR}/out"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Print functions
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Find NDK
find_ndk() {
    if [ -z "$ANDROID_NDK" ]; then
        if [ -n "$NDK_PATH" ]; then
            ANDROID_NDK="$NDK_PATH"
        elif [ -d "$HOME/Android/Sdk/ndk" ]; then
            ANDROID_NDK=$(ls -d $HOME/Android/Sdk/ndk/* | sort -V | tail -n 1)
        elif [ -d "$HOME/android-ndk" ]; then
            ANDROID_NDK=$(ls -d $HOME/android-ndk/* | sort -V | tail -n 1)
        fi
    fi
    
    if [ -z "$ANDROID_NDK" ]; then
        print_error "NDK not found! Set ANDROID_NDK environment variable."
        exit 1
    fi
    
    export ANDROID_NDK
    print_info "Using NDK: $ANDROID_NDK"
}

# Check dependencies
check_deps() {
    if ! command -v cmake &> /dev/null; then
        print_error "CMake not found!"
        exit 1
    fi
    if ! command -v ninja &> /dev/null; then
        print_error "Ninja not found!"
        exit 1
    fi
}

# Configure and Build for a specific architecture
build_arch() {
    local ARCH=$1
    local EXTRA_ARGS=$2
    local BUILD_SUBDIR="${BUILD_DIR}/${ARCH}"
    
    print_info "Building for ${ARCH}..."
    
    mkdir -p "${BUILD_SUBDIR}"
    mkdir -p "${OUT_DIR}"
    
    # Configure
    cmake -B "${BUILD_SUBDIR}" \
        -G Ninja \
        -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK}/build/cmake/android.toolchain.cmake" \
        -DANDROID_ABI="${ARCH}" \
        -DANDROID_PLATFORM=android-30 \
        -DBUILD_WEBUI=OFF \
        ${EXTRA_ARGS} \
        "${PROJECT_ROOT}"
        
    # Build
    cmake --build "${BUILD_SUBDIR}"
    
    # Check for binary string
    local BIN_NAME="hymod-${ARCH}"
    local BUILT_BIN="${BUILD_SUBDIR}/${BIN_NAME}"
    
    if [ -f "$BUILT_BIN" ]; then
        cp "$BUILT_BIN" "${OUT_DIR}/"
        print_success "Built ${BIN_NAME}"
    else
        print_error "Binary ${BIN_NAME} not found!"
        exit 1
    fi
}

# Main build logic
COMMAND="${1:-all}"
shift || true
NO_WEBUI=0
VERBOSE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-webui) NO_WEBUI=1; shift ;;
        --verbose|-v) VERBOSE="--verbose"; shift ;;
        *) shift ;;
    esac
done

check_deps
find_ndk

# Download WebUI fonts
download_fonts() {
    local FONTS_DIR="${PROJECT_ROOT}/webui/public/fonts"
    
    # Check if fonts already exist
    if [ -f "${FONTS_DIR}/Inter-Regular.woff2" ] && \
       [ -f "${FONTS_DIR}/NotoSansSC-Regular.woff2" ] && \
       [ -f "${FONTS_DIR}/JetBrainsMono-Regular.woff2" ]; then
        print_info "Fonts already downloaded, skipping..."
        return
    fi
    
    print_info "Downloading WebUI fonts..."
    mkdir -p "${FONTS_DIR}"
    
    # Download Inter
    curl -sL -o "${FONTS_DIR}/Inter-Regular.woff2" 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2'
    curl -sL -o "${FONTS_DIR}/Inter-Medium.woff2" 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa25L7.woff2'
    curl -sL -o "${FONTS_DIR}/Inter-SemiBold.woff2" 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa5ZL7.woff2'
    curl -sL -o "${FONTS_DIR}/Inter-Bold.woff2" 'https://fonts.gstatic.com/s/inter/v12/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa2JL7.woff2'
    
    # Download Noto Sans SC
    curl -sL -o "${FONTS_DIR}/NotoSansSC-Regular.woff2" 'https://fonts.gstatic.com/s/notosanssc/v26/k3kCo84MPvpLmixcA63oeALhL4iJ-Q7m8w.woff2'
    curl -sL -o "${FONTS_DIR}/NotoSansSC-Medium.woff2" 'https://fonts.gstatic.com/s/notosanssc/v26/k3kCo84MPvpLmixcA63oeALhL4iJ-RLm8w.woff2'
    curl -sL -o "${FONTS_DIR}/NotoSansSC-Bold.woff2" 'https://fonts.gstatic.com/s/notosanssc/v26/k3kCo84MPvpLmixcA63oeALhL4iJ-Xbm8w.woff2'
    
    # Download JetBrains Mono
    curl -sL -o "${FONTS_DIR}/JetBrainsMono-Regular.woff2" 'https://fonts.gstatic.com/s/jetbrainsmono/v13/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yK1jPVmUsaaDhw.woff2'
    curl -sL -o "${FONTS_DIR}/JetBrainsMono-Medium.woff2" 'https://fonts.gstatic.com/s/jetbrainsmono/v13/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.woff2'
    curl -sL -o "${FONTS_DIR}/JetBrainsMono-Bold.woff2" 'https://fonts.gstatic.com/s/jetbrainsmono/v13/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKwOPVmUsaaDhw.woff2'
    
    print_success "Fonts downloaded successfully"
}

# WebUI Handler
build_webui() {
    if [[ $NO_WEBUI -eq 0 ]]; then
        download_fonts
        print_info "Building WebUI..."
        # Use arm64 build dir for WebUI context or just project root context if possible
        # We can just run npm directly or use a dummy cmake run.
        # Let's use the arm64 build dir to run the webui target
        mkdir -p "${BUILD_DIR}/webui_build"
        cmake -B "${BUILD_DIR}/webui_build" -G Ninja -DBUILD_WEBUI=ON -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK}/build/cmake/android.toolchain.cmake" -DANDROID_ABI="arm64-v8a" "${PROJECT_ROOT}" > /dev/null
        cmake --build "${BUILD_DIR}/webui_build" --target webui
    fi
}

case $COMMAND in
    init)
        mkdir -p "${BUILD_DIR}"
        print_success "Initialized."
        ;;
    webui)
        NO_WEBUI=0
        build_webui
        ;;
    all)
        build_webui
        build_arch "arm64-v8a"
        build_arch "armeabi-v7a"
        build_arch "x86_64"
        print_success "All architectures built."
        ;;
    arm64)
        build_arch "arm64-v8a"
        ;;
    armv7)
        build_arch "armeabi-v7a"
        ;;
    x86_64)
        build_arch "x86_64"
        ;;
    package)
        build_webui
        build_arch "arm64-v8a"
        build_arch "armeabi-v7a"
        build_arch "x86_64"
        print_info "Packaging..."
        # Run package target from one of the builds
        cmake --build "${BUILD_DIR}/arm64-v8a" --target package
        ;;
    testzip)
        build_webui
        build_arch "arm64-v8a"
        print_info "Packaging Test Zip..."
        cmake --build "${BUILD_DIR}/arm64-v8a" --target testzip
        ;;
    clean)
        rm -rf "${BUILD_DIR}"
        print_success "Cleaned."
        ;;
    *)
        echo "Usage: $0 {init|all|webui|arm64|armv7|x86_64|package|testzip|clean}"
        exit 1
        ;;
esac
