#!/bin/bash
# Hymo Build Script for macOS
# Automatically detects and uses Android NDK from common locations

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

# Find NDK on macOS
find_ndk() {
    if [ -z "$ANDROID_NDK" ]; then
        print_info "Searching for Android NDK..."
        
        # Common NDK locations on macOS
        local POSSIBLE_PATHS=(
            "$HOME/Library/Android/sdk/ndk"
            "$HOME/android-sdk/ndk"
            "$HOME/Android/Sdk/ndk"
            "/usr/local/share/android-ndk"
            "/opt/android-ndk"
        )
        
        for base_path in "${POSSIBLE_PATHS[@]}"; do
            if [ -d "$base_path" ]; then
                # Get the latest version
                ANDROID_NDK=$(ls -d "$base_path"/* 2>/dev/null | sort -V | tail -n 1)
                if [ -n "$ANDROID_NDK" ] && [ -d "$ANDROID_NDK" ]; then
                    break
                fi
            fi
        done
        
        # Try brew installation
        if [ -z "$ANDROID_NDK" ] || [ ! -d "$ANDROID_NDK" ]; then
            if command -v brew &> /dev/null; then
                local BREW_NDK=$(brew --prefix android-ndk 2>/dev/null || echo "")
                if [ -n "$BREW_NDK" ] && [ -d "$BREW_NDK" ]; then
                    ANDROID_NDK="$BREW_NDK"
                fi
            fi
        fi
    fi
    
    if [ -z "$ANDROID_NDK" ] || [ ! -d "$ANDROID_NDK" ]; then
        print_error "Android NDK not found!"
        echo ""
        echo "Please install Android NDK using one of these methods:"
        echo ""
        echo "1. Using Homebrew:"
        echo "   brew install --cask android-ndk"
        echo ""
        echo "2. Using Android Studio SDK Manager"
        echo ""
        echo "3. Manual download from:"
        echo "   https://developer.android.com/ndk/downloads"
        echo ""
        echo "4. Set ANDROID_NDK environment variable:"
        echo "   export ANDROID_NDK=/path/to/ndk"
        exit 1
    fi
    
    export ANDROID_NDK
    print_success "Found NDK: $ANDROID_NDK"
}

# Check dependencies
check_deps() {
    local missing_deps=()
    
    if ! command -v cmake &> /dev/null; then
        missing_deps+=("cmake")
    fi
    
    if ! command -v ninja &> /dev/null; then
        missing_deps+=("ninja")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_error "Missing dependencies: ${missing_deps[*]}"
        echo ""
        if command -v brew &> /dev/null; then
            echo "Install with Homebrew:"
            echo "  brew install ${missing_deps[*]}"
        else
            echo "Please install: ${missing_deps[*]}"
        fi
        exit 1
    fi
    
    print_success "All dependencies found (cmake, ninja)"
}

# Fix toolchain file for macOS
fix_toolchain() {
    local TOOLCHAIN_FILE="$PROJECT_ROOT/cmake/android-toolchain.cmake"
    local TEMP_FILE="$BUILD_DIR/android-toolchain-macos.cmake"
    
    mkdir -p "$BUILD_DIR"
    
    # Detect macOS architecture
    local HOST_ARCH=$(uname -m)
    if [ "$HOST_ARCH" = "arm64" ]; then
        local NDK_HOST="darwin-x86_64"  # NDK still uses this name even on ARM
        print_info "macOS ARM64 detected, using darwin-x86_64 NDK toolchain"
    else
        local NDK_HOST="darwin-x86_64"
        print_info "macOS Intel detected, using darwin-x86_64 NDK toolchain"
    fi
    
    # Create modified toolchain file
    cat > "$TEMP_FILE" << 'EOF'
# Android NDK toolchain file for CMake (macOS version)
set(CMAKE_SYSTEM_NAME Android)
set(CMAKE_SYSTEM_VERSION ${ANDROID_API_LEVEL})

# Set the NDK path
if(NOT DEFINED ANDROID_NDK)
    if(DEFINED ENV{ANDROID_NDK})
        set(ANDROID_NDK $ENV{ANDROID_NDK})
    elseif(DEFINED ENV{NDK_PATH})
        set(ANDROID_NDK $ENV{NDK_PATH})
    else()
        message(FATAL_ERROR "Please set ANDROID_NDK environment variable")
    endif()
endif()

set(CMAKE_ANDROID_NDK ${ANDROID_NDK})

# Toolchain settings
set(CMAKE_ANDROID_NDK_TOOLCHAIN_VERSION clang)
set(CMAKE_ANDROID_STL_TYPE c++_static)

# Set the target architecture
if(NOT DEFINED ANDROID_ABI)
    set(ANDROID_ABI arm64-v8a)
endif()

set(CMAKE_ANDROID_ARCH_ABI ${ANDROID_ABI})

# Detect macOS architecture and use appropriate NDK host
if(CMAKE_HOST_SYSTEM_PROCESSOR MATCHES "arm64|aarch64")
    # macOS ARM (Apple Silicon) - NDK uses darwin-x86_64 path
    set(NDK_HOST_TAG "darwin-x86_64")
else()
    set(NDK_HOST_TAG "darwin-x86_64")
endif()

# Find the toolchain
set(ANDROID_TOOLCHAIN_PREFIX ${ANDROID_NDK}/toolchains/llvm/prebuilt/${NDK_HOST_TAG})

# Set compilers
if(ANDROID_ABI STREQUAL "arm64-v8a")
    set(ANDROID_TOOLCHAIN_NAME aarch64-linux-android)
elseif(ANDROID_ABI STREQUAL "armeabi-v7a")
    set(ANDROID_TOOLCHAIN_NAME armv7a-linux-androideabi)
elseif(ANDROID_ABI STREQUAL "x86_64")
    set(ANDROID_TOOLCHAIN_NAME x86_64-linux-android)
else()
    message(FATAL_ERROR "Unsupported Android ABI: ${ANDROID_ABI}")
endif()

set(CMAKE_C_COMPILER ${ANDROID_TOOLCHAIN_PREFIX}/bin/${ANDROID_TOOLCHAIN_NAME}${ANDROID_API_LEVEL}-clang)
set(CMAKE_CXX_COMPILER ${ANDROID_TOOLCHAIN_PREFIX}/bin/${ANDROID_TOOLCHAIN_NAME}${ANDROID_API_LEVEL}-clang++)
set(CMAKE_AR ${ANDROID_TOOLCHAIN_PREFIX}/bin/llvm-ar CACHE FILEPATH "Archiver")
set(CMAKE_RANLIB ${ANDROID_TOOLCHAIN_PREFIX}/bin/llvm-ranlib CACHE FILEPATH "Ranlib")
set(CMAKE_STRIP ${ANDROID_TOOLCHAIN_PREFIX}/bin/llvm-strip CACHE FILEPATH "Strip")

# Prevent CMake from testing compiler
set(CMAKE_C_COMPILER_WORKS TRUE)
set(CMAKE_CXX_COMPILER_WORKS TRUE)
EOF
    
    print_success "Generated macOS-compatible toolchain file"
}

# Configure and Build for a specific architecture
build_arch() {
    local ARCH=$1
    local EXTRA_ARGS=$2
    local BUILD_SUBDIR="${BUILD_DIR}/${ARCH}"
    
    print_info "Building for ${ARCH}..."
    
    mkdir -p "${BUILD_SUBDIR}"
    mkdir -p "${OUT_DIR}"
    
    # Configure - use NDK's official toolchain file
    cmake -B "${BUILD_SUBDIR}" \
        -G Ninja \
        -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK}/build/cmake/android.toolchain.cmake" \
        -DANDROID_ABI="${ARCH}" \
        -DANDROID_PLATFORM=android-30 \
        -DBUILD_WEBUI=OFF \
        ${EXTRA_ARGS} \
        "${PROJECT_ROOT}"
    
    # Build
    cmake --build "${BUILD_SUBDIR}" $VERBOSE
    
    # Check for binary
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

# WebUI Builder
build_webui() {
    if [[ $NO_WEBUI -eq 0 ]]; then
        download_fonts
        print_info "Building WebUI..."
        mkdir -p "${BUILD_DIR}/webui_build"
        
        # Check if Node.js is installed
        if ! command -v npm &> /dev/null; then
            print_warning "Node.js/npm not found. Skipping WebUI build."
            print_info "Install with: brew install node"
            return
        fi
        
        cmake -B "${BUILD_DIR}/webui_build" \
            -G Ninja \
            -DBUILD_WEBUI=ON \
            -DCMAKE_TOOLCHAIN_FILE="${ANDROID_NDK}/build/cmake/android.toolchain.cmake" \
            -DANDROID_ABI="arm64-v8a" \
            -DANDROID_PLATFORM=android-30 \
            "${PROJECT_ROOT}" > /dev/null
        
        cmake --build "${BUILD_DIR}/webui_build" --target webui
        print_success "WebUI built"
    fi
}

# Main
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

echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Hymo Build Script for macOS          ║"
echo "╚════════════════════════════════════════╝"
echo ""

check_deps
find_ndk
fix_toolchain

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
        echo "Usage: $0 {init|all|webui|arm64|armv7|x86_64|package|testzip|clean} [--no-webui] [--verbose]"
        echo ""
        echo "Commands:"
        echo "  init     - Initialize build directory"
        echo "  webui    - Build WebUI only"
        echo "  all      - Build all architectures (default)"
        echo "  arm64    - Build arm64-v8a only"
        echo "  armv7    - Build armeabi-v7a only"
        echo "  x86_64   - Build x86_64 only"
        echo "  package  - Build all and create flashable zip"
        echo "  testzip  - Build arm64 test zip"
        echo "  clean    - Clean build directory"
        echo ""
        echo "Options:"
        echo "  --no-webui  - Skip WebUI build"
        echo "  --verbose   - Verbose build output"
        exit 1
        ;;
esac

echo ""
print_success "Build completed!"
echo ""
