cmake_minimum_required(VERSION 3.22)
project(Hymo VERSION 1.0.0 LANGUAGES C CXX)

# Options
option(BUILD_WEBUI "Build WebUI before compiling" ON)

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
    src/core/planner.cpp
    src/core/executor.cpp
    src/mount/overlay.cpp
    src/mount/magic.cpp
    src/mount/hymofs.cpp
)

# Common compile options
include(CheckIPOSupported)
check_ipo_supported(RESULT LTO_SUPPORTED OUTPUT error)

set(HYMO_COMPILE_OPTIONS
    -Os
    -Wall
    -Wextra
    -Wno-unused-parameter
    -fPIE
    -ffunction-sections
    -fdata-sections
)

set(HYMO_COMPILE_DEFINITIONS
    __ANDROID__
)

set(HYMO_LINK_OPTIONS
    -static-libstdc++
    -static-libgcc
    -pie
    -Wl,--gc-sections
)

# Check if we are cross compiling for Android
if(ANDROID)
    set(TARGET_NAME hymod-${ANDROID_ABI})
    
    add_executable(${TARGET_NAME} ${HYMO_SOURCES})
    target_include_directories(${TARGET_NAME} PRIVATE ${CMAKE_SOURCE_DIR}/src)
    target_compile_options(${TARGET_NAME} PRIVATE ${HYMO_COMPILE_OPTIONS})
    target_compile_definitions(${TARGET_NAME} PRIVATE ${HYMO_COMPILE_DEFINITIONS})
    target_link_options(${TARGET_NAME} PRIVATE ${HYMO_LINK_OPTIONS})

    if(LTO_SUPPORTED)
        message(STATUS "LTO/IPO is supported and enabled")
        set_property(TARGET ${TARGET_NAME} PROPERTY INTERPROCEDURAL_OPTIMIZATION TRUE)
    else()
        message(WARNING "LTO/IPO is not supported: ${error}")
    endif()
    
    # Strip binary after build
    add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
        COMMAND "${CMAKE_STRIP}" "$<TARGET_FILE:${TARGET_NAME}>"
        COMMENT "Stripping ${TARGET_NAME}"
    )
    
    # Show binary size
    add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E echo "✅ ${ANDROID_ABI}: " && du -h "$<TARGET_FILE:${TARGET_NAME}>" | cut -f1
        VERBATIM
    )
endif()

# WebUI target
if(BUILD_WEBUI)
    add_custom_target(webui
        COMMAND ${CMAKE_COMMAND} -E echo "🎨 Building WebUI..."
        COMMAND npm install
        COMMAND npm run build
        COMMAND ${CMAKE_COMMAND} -E echo "Cleaning old webroot..."
        COMMAND ${CMAKE_COMMAND} -E remove_directory "${CMAKE_SOURCE_DIR}/module/webroot"
        COMMAND ${CMAKE_COMMAND} -E echo "Creating webroot..."
        COMMAND ${CMAKE_COMMAND} -E make_directory "${CMAKE_SOURCE_DIR}/module/webroot"
        COMMAND ${CMAKE_COMMAND} -E echo "Copying files..."
        COMMAND ${CMAKE_COMMAND} -E copy_directory "${CMAKE_SOURCE_DIR}/webui/dist" "${CMAKE_SOURCE_DIR}/module/webroot"
        COMMAND ${CMAKE_COMMAND} -E echo "✅ WebUI built to module/webroot"
        WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}/webui"
        COMMENT "Building WebUI with npm"
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

