#!/bin/bash
# Hymo Build Script - CMake + Ninja
# Usage: ./build.sh [target] [options]

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() { echo -e "${BLUE}ℹ${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }

# Show help
show_help() {
    cat << EOF
Hymo Build System - CMake + Ninja

Usage: ./build.sh [command] [options]

Commands:
    init        - Initialize build directory (first time setup)
    all         - Build all architectures (default)
    webui       - Build WebUI only
    arm64       - Build ARM64 only
    armv7       - Build ARMv7 only
    x86_64      - Build x86_64 only
    package     - Create module package
    testzip     - Create test package (arm64 only)
    install     - Push to device via adb
    clean       - Clean build directory
    distclean   - Clean everything including WebUI
    help        - Show this help

Options:
    --no-webui      Skip WebUI build
    --arm64-only    Build ARM64 only
    --verbose       Verbose output

Examples:
    ./build.sh init                 # First time setup
    ./build.sh all                  # Build everything
    ./build.sh arm64 --no-webui     # Build ARM64 without WebUI
    ./build.sh package              # Create package
    ./build.sh clean && ./build.sh  # Clean build

EOF
}

# Parse arguments
COMMAND="${1:-all}"
shift || true

NO_WEBUI=0
ARM64_ONLY=0
VERBOSE=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-webui)
            NO_WEBUI=1
            shift
            ;;
        --arm64-only)
            ARM64_ONLY=1
            shift
            ;;
        --verbose|-v)
            VERBOSE="-v"
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Check dependencies
check_deps() {
    print_info "Checking dependencies..."
    
    if ! command -v cmake &> /dev/null; then
        print_error "CMake not found! Install with: sudo apt install cmake"
        exit 1
    fi
    
    if ! command -v ninja &> /dev/null; then
        print_error "Ninja not found! Install with: sudo apt install ninja-build"
        exit 1
    fi
    
    if ! command -v node &> /dev/null; then
        print_warning "Node.js not found! WebUI build will fail"
    fi
    
    print_success "All dependencies OK"
}

# Initialize build directory
init_build() {
    print_info "Initializing build directory..."
    
    check_deps
    
    mkdir -p "${BUILD_DIR}"
    cd "${BUILD_DIR}"
    
    CMAKE_OPTS="-G Ninja"
    
    if [[ $NO_WEBUI -eq 1 ]]; then
        CMAKE_OPTS="$CMAKE_OPTS -DBUILD_WEBUI=OFF"
    fi
    
    if [[ $ARM64_ONLY -eq 1 ]]; then
        CMAKE_OPTS="$CMAKE_OPTS -DBUILD_ARMV7=OFF -DBUILD_X86_64=OFF"
    fi
    
    print_info "Running CMake..."
    cmake $CMAKE_OPTS "${PROJECT_ROOT}"
    
    print_success "Build directory initialized"
}

# Build target
build_target() {
    local target=$1
    
    if [[ ! -d "${BUILD_DIR}" ]]; then
        print_warning "Build directory not initialized, running init..."
        init_build
    fi
    
    cd "${BUILD_DIR}"
    
    print_info "Building target: ${target}"
    ninja $VERBOSE $target
    
    print_success "Build complete!"
}

# Clean
clean_build() {
    print_info "Cleaning build directory..."
    rm -rf "${BUILD_DIR}"
    print_success "Clean complete"
}

# Distclean
distclean() {
    print_info "Cleaning everything..."
    rm -rf "${BUILD_DIR}"
    rm -rf "${PROJECT_ROOT}/webui/dist"
    rm -rf "${PROJECT_ROOT}/webui/node_modules"
    rm -rf "${PROJECT_ROOT}/module/webroot"
    rm -f "${PROJECT_ROOT}"/*.zip
    print_success "Distclean complete"
}

# Main command handler
case $COMMAND in
    init)
        init_build
        ;;
    all)
        if [[ ! -d "${BUILD_DIR}" ]]; then
            init_build
        fi
        if [[ $NO_WEBUI -eq 0 ]]; then
            build_target webui
        fi
        build_target all
        ;;
    webui)
        build_target webui
        ;;
    arm64)
        build_target hymod-arm64-v8a
        ;;
    armv7)
        build_target hymod-armeabi-v7a
        ;;
    x86_64)
        build_target hymod-x86_64
        ;;
    package)
        build_target package
        ;;
    testzip)
        if [[ ! -d "${BUILD_DIR}" ]]; then
            init_build
        fi
        if [[ $NO_WEBUI -eq 0 ]]; then
            build_target webui
        fi
        build_target hymod-arm64-v8a
        build_target testzip
        ;;
    install)
        build_target install-device
        ;;
    clean)
        clean_build
        ;;
    distclean)
        distclean
        ;;
    help|-h|--help)
        show_help
        ;;
    *)
        print_error "Unknown command: $COMMAND"
        show_help
        exit 1
        ;;
esac

print_success "Done!"
