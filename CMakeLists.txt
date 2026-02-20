cmake_minimum_required(VERSION 3.22)
project(Hymo VERSION 1.0.0 LANGUAGES C CXX)

# Read version from module.prop
file(READ "${CMAKE_SOURCE_DIR}/module/module.prop" MODULE_PROP_CONTENT)
string(REGEX MATCH "version=([^\n]+)" _ ${MODULE_PROP_CONTENT})
set(MODULE_VERSION ${CMAKE_MATCH_1})
string(REGEX MATCH "id=([^\n]+)" _ ${MODULE_PROP_CONTENT})
set(MODULE_ID ${CMAKE_MATCH_1})

message(STATUS "Building ${MODULE_ID} ${MODULE_VERSION}")
if(DEFINED ANDROID_ABI)
    message(STATUS "Target Architecture: ${ANDROID_ABI}")
    message(STATUS "C Compiler: ${CMAKE_C_COMPILER}")
    message(STATUS "CXX Compiler: ${CMAKE_CXX_COMPILER}")
endif()

# Android settings
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

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
    src/core/lkm.cpp
    src/core/planner.cpp
    src/core/executor.cpp
    src/core/user_rules.cpp
    src/mount/hymofs.cpp
    src/mount/mount_utils.cpp
    src/mount/partition_utils.cpp
)

# Size optimization
set(HYMO_COMPILE_OPTIONS
    -Oz
    -DNDEBUG
    -Wall
    -Wextra
    -Wno-unused-parameter
    -fPIE
    -ffunction-sections
    -fdata-sections
    -flto=full
    -fvisibility=hidden
    -fvisibility-inlines-hidden
    -fno-rtti
    -fno-asynchronous-unwind-tables
    -fmerge-all-constants
    -fno-ident
    -faddrsig
    -fno-semantic-interposition
)

set(HYMO_COMPILE_DEFINITIONS
    __ANDROID__
)

set(HYMO_LINK_OPTIONS
    -static-libstdc++
    -static-libgcc
    -pie
    -fuse-ld=lld
    -flto=full
    -Wl,--gc-sections
    -Wl,--icf=all
    -Wl,--strip-all
    -Wl,--exclude-libs,ALL
    -Wl,-O2
    -Wl,--lto-O3
    -Wl,--hash-style=gnu
    -Wl,--build-id=none
    -Wl,-z,norelro
)

# Check if we are cross compiling for Android
if(ANDROID)
    set(TARGET_NAME hymod-${ANDROID_ABI})
    
    add_executable(${TARGET_NAME} ${HYMO_SOURCES})
    target_include_directories(${TARGET_NAME} PRIVATE ${CMAKE_SOURCE_DIR}/src)
    target_compile_options(${TARGET_NAME} PRIVATE ${HYMO_COMPILE_OPTIONS})
    target_compile_definitions(${TARGET_NAME} PRIVATE ${HYMO_COMPILE_DEFINITIONS})
    target_link_options(${TARGET_NAME} PRIVATE ${HYMO_LINK_OPTIONS})

    # Optional: UPX binary compression (--best --lzma)
    option(HYMOD_UPX "Use UPX to compress hymod binary" OFF)
    if(HYMOD_UPX)
        find_program(UPX_PROGRAM upx)
        if(UPX_PROGRAM)
            add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
                COMMAND ${UPX_PROGRAM} --best --lzma $<TARGET_FILE:${TARGET_NAME}>
                COMMENT "UPX: compressing ${TARGET_NAME} with LZMA (--best)..."
            )
            message(STATUS "UPX compression ENABLED (--best --lzma)")
        else()
            message(WARNING "HYMOD_UPX=ON but upx not found in PATH; skipping UPX compression")
        endif()
    endif()

    # Show binary size
    add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E echo "✅ ${ANDROID_ABI}: " && du -h "$<TARGET_FILE:${TARGET_NAME}>" | cut -f1
        VERBATIM
    )
endif()

# Package target (Runs in the root build context or expects artifacts in ../out)
set(E_OUT_DIR "${CMAKE_SOURCE_DIR}/build/out")

add_custom_target(package
    COMMAND ${CMAKE_COMMAND} -E echo "📦 Creating module package..."
    COMMAND ${CMAKE_COMMAND} -E make_directory ${E_OUT_DIR}
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_BINARY_DIR}/pkg_temp
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/pkg_temp
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/module ${CMAKE_BINARY_DIR}/pkg_temp
    # Copy binaries 
    COMMAND bash -c "cp ${E_OUT_DIR}/hymod-* ${CMAKE_BINARY_DIR}/pkg_temp/ || echo '⚠️ Warning: No binaries found in build/out'"
    COMMAND bash -c "chmod 755 ${CMAKE_BINARY_DIR}/pkg_temp/hymod-*"
    COMMAND bash -c "cd ${CMAKE_BINARY_DIR}/pkg_temp && zip -q -r ${E_OUT_DIR}/${MODULE_ID}-${MODULE_VERSION}.zip ."
    COMMAND ${CMAKE_COMMAND} -E echo "✅ Package: ${E_OUT_DIR}/${MODULE_ID}-${MODULE_VERSION}.zip"
    COMMAND ls -lh ${E_OUT_DIR}/${MODULE_ID}-${MODULE_VERSION}.zip
    COMMENT "Creating module package"
    VERBATIM
)

# Test package (current arch only)
if(ANDROID)
add_custom_target(testzip
    COMMAND ${CMAKE_COMMAND} -E echo "📦 Creating test package (${ANDROID_ABI})..."
    COMMAND ${CMAKE_COMMAND} -E make_directory ${E_OUT_DIR}
    COMMAND ${CMAKE_COMMAND} -E remove_directory ${CMAKE_BINARY_DIR}/test_pkg
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/test_pkg
    COMMAND ${CMAKE_COMMAND} -E copy_directory ${CMAKE_SOURCE_DIR}/module ${CMAKE_BINARY_DIR}/test_pkg
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:${TARGET_NAME}> ${CMAKE_BINARY_DIR}/test_pkg/
    COMMAND chmod 755 ${CMAKE_BINARY_DIR}/test_pkg/${TARGET_NAME}
    COMMAND bash -c "cd ${CMAKE_BINARY_DIR}/test_pkg && zip -q -r ${E_OUT_DIR}/${MODULE_ID}-${MODULE_VERSION}.zip ."
    COMMAND ${CMAKE_COMMAND} -E echo "✅ Test package: ${E_OUT_DIR}/${MODULE_ID}-${MODULE_VERSION}.zip"
    COMMAND ls -lh ${E_OUT_DIR}/${MODULE_ID}-${MODULE_VERSION}.zip
    COMMENT "Creating test package for current arch"
    VERBATIM
)
endif()

