#!/bin/bash
# Hymo Universal Build Script
# Works on both Linux and macOS, automatically detects OS and NDK

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

# Detect OS
OS_TYPE="unknown"
case "$(uname -s)" in
    Linux*)     OS_TYPE="linux";;
    Darwin*)    OS_TYPE="macos";;
    *)          OS_TYPE="unknown";;
esac

# Print functions
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Find NDK based on OS
find_ndk() {
    if [ -n "$ANDROID_NDK" ] && [ -d "$ANDROID_NDK" ]; then
        print_success "Using NDK from environment: $ANDROID_NDK"
        return 0
    fi

    print_info "Searching for Android NDK..."
    
    # Common NDK locations for both Linux and macOS
    local POSSIBLE_PATHS=(
        "$HOME/Library/Android/sdk/ndk"        # macOS - Android Studio
        "$HOME/android-sdk/ndk"                 # Generic
        "$HOME/Android/Sdk/ndk"                 # Linux - Android Studio
        "$HOME/android-ndk"                     # Manual install
        "/usr/local/share/android-ndk"         # System install
        "/opt/android-ndk"                      # System install
        "$HOME/.local/share/android-ndk"       # User install
    )
    
    for base_path in "${POSSIBLE_PATHS[@]}"; do
        if [ -d "$base_path" ]; then
            # Get the latest version
            ANDROID_NDK=$(find "$base_path" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort -V | tail -n 1)
            if [ -n "$ANDROID_NDK" ] && [ -d "$ANDROID_NDK" ]; then
                break
            fi
        fi
    done
    
    # Try package managers
    if [ -z "$ANDROID_NDK" ] || [ ! -d "$ANDROID_NDK" ]; then
        if [ "$OS_TYPE" = "macos" ] && command -v brew &> /dev/null; then
            local BREW_NDK=$(brew --prefix android-ndk 2>/dev/null || echo "")
            if [ -n "$BREW_NDK" ] && [ -d "$BREW_NDK" ]; then
                ANDROID_NDK="$BREW_NDK"
            fi
        fi
    fi
    
    if [ -z "$ANDROID_NDK" ] || [ ! -d "$ANDROID_NDK" ]; then
        print_error "Android NDK not found!"
        echo ""
        echo "Please install Android NDK using one of these methods:"
        echo ""
        if [ "$OS_TYPE" = "macos" ]; then
            echo "1. Using Homebrew:"
            echo "   brew install --cask android-ndk"
            echo ""
        fi
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
        if [ "$OS_TYPE" = "macos" ]; then
            if command -v brew &> /dev/null; then
                echo "Install with Homebrew:"
                echo "  brew install ${missing_deps[*]}"
            else
                echo "Please install: ${missing_deps[*]}"
            fi
        else
            echo "Install with your package manager, for example:"
            echo "  Ubuntu/Debian: sudo apt install ${missing_deps[*]}"
            echo "  Fedora: sudo dnf install ${missing_deps[*]}"
            echo "  Arch: sudo pacman -S ${missing_deps[*]}"
        fi
        exit 1
    fi
    
    print_success "All dependencies found (cmake, ninja)"
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
        
        # Show size
        local SIZE=$(du -h "$BUILT_BIN" | cut -f1)
        print_success "Built ${BIN_NAME} (${SIZE})"
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
            if [ "$OS_TYPE" = "macos" ]; then
                print_info "Install with: brew install node"
            else
                print_info "Install Node.js from your package manager"
            fi
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
echo "║   Hymo Universal Build Script          ║"
echo "║   OS: $(printf '%-31s' "$OS_TYPE")  ║"
echo "╚════════════════════════════════════════╝"
echo ""

check_deps
find_ndk

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
        echo ""
        print_success "All architectures built successfully!"
        echo ""
        print_info "Output directory: ${OUT_DIR}"
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
        if [ -d "${PROJECT_ROOT}/.git" ]; then
            COMMIT_COUNT=$(git -C "${PROJECT_ROOT}" rev-list --count HEAD 2>/dev/null || echo "0")
            SHORT_HASH=$(git -C "${PROJECT_ROOT}" rev-parse --short=8 HEAD 2>/dev/null || echo "unknown")
            VERSION_TAG=$(git -C "${PROJECT_ROOT}" describe --tags --abbrev=0 2>/dev/null || echo "v0.0.0")
            PROP="${PROJECT_ROOT}/module/module.prop"
            if [ "$OS_TYPE" = "macos" ]; then
                sed -i '' "s/^version=.*/version=${VERSION_TAG}/" "$PROP"
                sed -i '' "s/^versionCode=.*/versionCode=${COMMIT_COUNT}/" "$PROP"
            else
                sed -i "s/^version=.*/version=${VERSION_TAG}/" "$PROP"
                sed -i "s/^versionCode=.*/versionCode=${COMMIT_COUNT}/" "$PROP"
            fi
            print_info "Module version: ${VERSION_TAG} (versionCode=${COMMIT_COUNT})"
        fi
        print_info "Packaging..."
        cmake --build "${BUILD_DIR}/arm64-v8a" --target package
        if [ -d "${PROJECT_ROOT}/.git" ] && [ -n "${VERSION_TAG}" ] && [ -n "${SHORT_HASH}" ]; then
            ( cd "${OUT_DIR}" && for f in hymo-*.zip; do [ -f "$f" ] && mv "$f" "hymo-${VERSION_TAG}-${SHORT_HASH}.zip" && break; done )
        fi
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
        echo ""
        echo "Detected OS: $OS_TYPE"
        exit 1
        ;;
esac

echo ""
print_success "Build completed!"
echo ""
