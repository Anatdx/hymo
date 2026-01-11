cmake_minimum_required(VERSION 3.22)
project(Hymo VERSION 1.0.0 LANGUAGES CXX)

# Options
option(BUILD_WEBUI "Build WebUI before compiling" ON)
option(BUILD_ARM64 "Build for arm64-v8a" ON)
option(BUILD_ARMV7 "Build for armeabi-v7a" ON)
option(BUILD_X86_64 "Build for x86_64" ON)

# Read version from module.prop
file(READ "${CMAKE_SOURCE_DIR}/module/module.prop" MODULE_PROP_CONTENT)
string(REGEX MATCH "version=([^\n]+)" _ ${MODULE_PROP_CONTENT})
set(MODULE_VERSION ${CMAKE_MATCH_1})
string(REGEX MATCH "id=([^\n]+)" _ ${MODULE_PROP_CONTENT})
set(MODULE_ID ${CMAKE_MATCH_1})

message(STATUS "Building ${MODULE_ID} v${MODULE_VERSION}")

# Android settings
set(ANDROID_API_LEVEL 30)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Find NDK
if(NOT DEFINED ANDROID_NDK)
    if(DEFINED ENV{ANDROID_NDK})
        set(ANDROID_NDK $ENV{ANDROID_NDK})
    elseif(DEFINED ENV{NDK_PATH})
        set(ANDROID_NDK $ENV{NDK_PATH})
    elseif(EXISTS "$ENV{HOME}/Android/Sdk/ndk")
        file(GLOB NDK_VERSIONS "$ENV{HOME}/Android/Sdk/ndk/*")
        list(SORT NDK_VERSIONS)
        list(REVERSE NDK_VERSIONS)
        list(GET NDK_VERSIONS 0 ANDROID_NDK)
    elseif(EXISTS "$ENV{HOME}/android-ndk")
        file(GLOB NDK_VERSIONS "$ENV{HOME}/android-ndk/*")
        list(SORT NDK_VERSIONS)
        list(REVERSE NDK_VERSIONS)
        list(GET NDK_VERSIONS 0 ANDROID_NDK)
    else()
        message(FATAL_ERROR "NDK not found! Set ANDROID_NDK or NDK_PATH environment variable")
    endif()
endif()

message(STATUS "Using NDK: ${ANDROID_NDK}")
set(CMAKE_ANDROID_NDK ${ANDROID_NDK})

# Source files
set(HYMO_SOURCES
    src/main.cpp
    src/utils.cpp
    src/conf/config.cpp
    src/core/inventory.cpp
    src/core/storage.cpp
    src/core/state.cpp
    src/core/sync.cpp
    src/core/modules.cpp
    src/core/planner.cpp
    src/core/executor.cpp
    src/mount/overlay.cpp
    src/mount/magic.cpp
    src/mount/hymofs.cpp
)

# Common compile options
set(HYMO_COMPILE_OPTIONS
    -O2
    -Wall
    -Wextra
    -Wno-unused-parameter
    -fPIE
)

set(HYMO_COMPILE_DEFINITIONS
    __ANDROID__
)

set(HYMO_LINK_OPTIONS
    -static-libstdc++
    -static-libgcc
    -pie
)

# Include directories
set(HYMO_INCLUDE_DIRS
    ${CMAKE_SOURCE_DIR}/src
)

# Function to create target for specific architecture
function(add_hymo_target ARCH TRIPLE)
    set(TARGET_NAME hymod-${ARCH})
    
    # Set toolchain file
    set(CMAKE_SYSTEM_NAME Android)
    set(CMAKE_SYSTEM_VERSION ${ANDROID_API_LEVEL})
    set(CMAKE_ANDROID_ARCH_ABI ${ARCH})
    
    # Find compiler
    set(TOOLCHAIN_PREFIX ${ANDROID_NDK}/toolchains/llvm/prebuilt/linux-x86_64)
    set(COMPILER ${TOOLCHAIN_PREFIX}/bin/${TRIPLE}${ANDROID_API_LEVEL}-clang++)
    set(STRIP ${TOOLCHAIN_PREFIX}/bin/llvm-strip)
    
    if(NOT EXISTS ${COMPILER})
        message(WARNING "Compiler not found for ${ARCH}: ${COMPILER}")
        return()
    endif()
    
    # Create executable
    add_executable(${TARGET_NAME} ${HYMO_SOURCES})
    
    target_include_directories(${TARGET_NAME} PRIVATE ${HYMO_INCLUDE_DIRS})
    target_compile_options(${TARGET_NAME} PRIVATE ${HYMO_COMPILE_OPTIONS})
    target_compile_definitions(${TARGET_NAME} PRIVATE ${HYMO_COMPILE_DEFINITIONS})
    target_link_options(${TARGET_NAME} PRIVATE ${HYMO_LINK_OPTIONS})
    
    # Set compiler
    set_target_properties(${TARGET_NAME} PROPERTIES
        CXX_COMPILER ${COMPILER}
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/out
    )
    
    # Strip binary after build
    add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
        COMMAND ${STRIP} $<TARGET_FILE:${TARGET_NAME}>
        COMMENT "Stripping ${TARGET_NAME}"
    )
    
    # Show binary size
    add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E echo "✅ ${ARCH}: " && du -h $<TARGET_FILE:${TARGET_NAME}> | cut -f1
        VERBATIM
    )
endfunction()

# Build targets for different architectures
if(BUILD_ARM64)
    message(STATUS "Adding arm64-v8a target")
    add_hymo_target(arm64-v8a aarch64-linux-android)
endif()

if(BUILD_ARMV7)
    message(STATUS "Adding armeabi-v7a target")
    add_hymo_target(armeabi-v7a armv7a-linux-androideabi)
endif()

if(BUILD_X86_64)
    message(STATUS "Adding x86_64 target")
    add_hymo_target(x86_64 x86_64-linux-android)
endif()

# WebUI target
if(BUILD_WEBUI)
    add_custom_target(webui
        COMMAND ${CMAKE_COMMAND} -E echo "🎨 Building WebUI..."
        COMMAND cd ${CMAKE_SOURCE_DIR}/webui && npm install
        COMMAND cd ${CMAKE_SOURCE_DIR}/webui && npm run build
        COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_SOURCE_DIR}/module/webroot
        COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/webui/dist ${CMAKE_SOURCE_DIR}/module/webroot
        COMMAND ${CMAKE_COMMAND} -E echo "✅ WebUI built -> module/webroot/"
        WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
        COMMENT "Building WebUI with npm"
    )
endif()

# Package target
add_custom_target(package
    COMMAND ${CMAKE_COMMAND} -E echo "📦 Creating module package..."
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_BINARY_DIR}/build
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/build
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/module ${CMAKE_BINARY_DIR}/build
    COMMAND bash -c "cp ${CMAKE_BINARY_DIR}/out/hymod-* ${CMAKE_BINARY_DIR}/build/ || true"
    COMMAND bash -c "chmod 755 ${CMAKE_BINARY_DIR}/build/hymod-* || true"
    COMMAND bash -c "cd ${CMAKE_BINARY_DIR}/build && zip -q -r ../out/${MODULE_ID}-${MODULE_VERSION}.zip *"
    COMMAND ${CMAKE_COMMAND} -E echo "✅ Package: ${CMAKE_BINARY_DIR}/out/${MODULE_ID}-${MODULE_VERSION}.zip"
    COMMAND ls -lh ${CMAKE_BINARY_DIR}/out/${MODULE_ID}-${MODULE_VERSION}.zip
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Creating module package"
)

# Test package (arm64 only)
add_custom_target(testzip
    COMMAND ${CMAKE_COMMAND} -E echo "📦 Creating test package (arm64 only)..."
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_BINARY_DIR}/build
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/build
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/module ${CMAKE_BINARY_DIR}/build
    COMMAND ${CMAKE_COMMAND} -E copy_if_different ${CMAKE_BINARY_DIR}/out/hymod-arm64-v8a ${CMAKE_BINARY_DIR}/build/
    COMMAND chmod 755 ${CMAKE_BINARY_DIR}/build/hymod-arm64-v8a
    COMMAND cd ${CMAKE_BINARY_DIR}/build && zip -r ../out/${MODULE_ID}-${MODULE_VERSION}.zip * > /dev/null
    COMMAND ${CMAKE_COMMAND} -E echo "✅ Test package: ${CMAKE_BINARY_DIR}/out/${MODULE_ID}-${MODULE_VERSION}.zip"
    COMMAND ls -lh ${CMAKE_BINARY_DIR}/out/${MODULE_ID}-${MODULE_VERSION}.zip
    WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
    COMMENT "Creating test package"
)

# Install target (push to device via adb)
add_custom_target(install-device
    COMMAND ${CMAKE_COMMAND} -E echo "📱 Uploading to device..."
    COMMAND adb push ${CMAKE_BINARY_DIR}/out/${MODULE_ID}-${MODULE_VERSION}.zip /sdcard/ && echo "✅ Uploaded" || echo "⚠️  adb not available"
    DEPENDS package
    COMMENT "Installing to Android device"
)

# Clean webui
add_custom_target(clean-webui
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_SOURCE_DIR}/module/webroot
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_SOURCE_DIR}/webui/dist
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_SOURCE_DIR}/webui/node_modules
    COMMENT "Cleaning WebUI build files"
)

# Help target
add_custom_target(help-build
    COMMAND ${CMAKE_COMMAND} -E echo "Hymo Build System - CMake + Ninja"
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "Targets:"
    COMMAND ${CMAKE_COMMAND} -E echo "  all           - Build all architectures"
    COMMAND ${CMAKE_COMMAND} -E echo "  webui         - Build WebUI only"
    COMMAND ${CMAKE_COMMAND} -E echo "  hymod-arm64-v8a    - Build ARM 64-bit only"
    COMMAND ${CMAKE_COMMAND} -E echo "  hymod-armeabi-v7a  - Build ARM 32-bit only"
    COMMAND ${CMAKE_COMMAND} -E echo "  hymod-x86_64       - Build Intel 64-bit only"
    COMMAND ${CMAKE_COMMAND} -E echo "  package       - Create module package"
    COMMAND ${CMAKE_COMMAND} -E echo "  testzip       - Create test package (arm64 only)"
    COMMAND ${CMAKE_COMMAND} -E echo "  install-device - Push to device via adb"
    COMMAND ${CMAKE_COMMAND} -E echo "  clean         - Clean build files"
    COMMAND ${CMAKE_COMMAND} -E echo "  clean-webui   - Clean WebUI files"
    COMMAND ${CMAKE_COMMAND} -E echo ""
    COMMAND ${CMAKE_COMMAND} -E echo "Options:"
    COMMAND ${CMAKE_COMMAND} -E echo "  -DBUILD_WEBUI=OFF     - Skip WebUI build"
    COMMAND ${CMAKE_COMMAND} -E echo "  -DBUILD_ARM64=OFF     - Skip ARM64 build"
    COMMAND ${CMAKE_COMMAND} -E echo "  -DBUILD_ARMV7=OFF     - Skip ARMv7 build"
    COMMAND ${CMAKE_COMMAND} -E echo "  -DBUILD_X86_64=OFF    - Skip x86_64 build"
    COMMENT "Showing help"
)
