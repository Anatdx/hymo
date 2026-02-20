cmake_minimum_required(VERSION 3.22)
project(Hymo VERSION 1.0.0 LANGUAGES C CXX)

if(EXISTS "${CMAKE_SOURCE_DIR}/module/module.prop")
    file(READ "${CMAKE_SOURCE_DIR}/module/module.prop" MODULE_PROP_CONTENT)
    string(REGEX MATCH "version=([^\n]+)" _ ${MODULE_PROP_CONTENT})
    set(MODULE_VERSION ${CMAKE_MATCH_1})
    string(REGEX MATCH "id=([^\n]+)" _ ${MODULE_PROP_CONTENT})
    set(MODULE_ID ${CMAKE_MATCH_1})
else()
    set(MODULE_ID hymo)
    set(MODULE_VERSION 1.0.0)
endif()
message(STATUS "Building libhymo (${MODULE_ID} ${MODULE_VERSION})")
if(DEFINED ANDROID_ABI)
    message(STATUS "Target Architecture: ${ANDROID_ABI}")
    message(STATUS "C Compiler: ${CMAKE_C_COMPILER}")
    message(STATUS "CXX Compiler: ${CMAKE_CXX_COMPILER}")
endif()

# Android settings
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Source files (minimal low-level lib: HymoFS ioctl + LKM only)
set(HYMO_SOURCES
    src/utils.cpp
    src/core/lkm.cpp
    src/mount/hymofs.cpp
)

# Size optimization (no debug info)
set(CMAKE_C_FLAGS_RELEASE "-DNDEBUG -g0")
set(CMAKE_CXX_FLAGS_RELEASE "-DNDEBUG -g0")
set(HYMO_COMPILE_OPTIONS
    -Oz
    -DNDEBUG
    -g0
    -Wall
    -Wextra
    -Wno-unused-parameter
    -fPIC
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

# Static library (minimal HymoFS core)
if(ANDROID)
    set(TARGET_NAME hymo-${ANDROID_ABI})
    add_library(${TARGET_NAME} STATIC ${HYMO_SOURCES})
    target_include_directories(${TARGET_NAME} PRIVATE ${CMAKE_SOURCE_DIR}/src)
    target_compile_options(${TARGET_NAME} PRIVATE ${HYMO_COMPILE_OPTIONS})
    target_compile_definitions(${TARGET_NAME} PRIVATE ${HYMO_COMPILE_DEFINITIONS})
    add_custom_command(TARGET ${TARGET_NAME} POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E echo "✅ ${ANDROID_ABI}: libhymo.a" && du -h "$<TARGET_FILE:${TARGET_NAME}>" | cut -f1
        VERBATIM
    )
endif()

# Copy lib to out
set(E_OUT_DIR "${CMAKE_SOURCE_DIR}/build/out")
if(ANDROID)
add_custom_target(copy-lib
    COMMAND ${CMAKE_COMMAND} -E make_directory ${E_OUT_DIR}
    COMMAND ${CMAKE_COMMAND} -E copy $<TARGET_FILE:${TARGET_NAME}> ${E_OUT_DIR}/libhymo_${ANDROID_ABI}.a
    COMMENT "Copy libhymo.a to build/out"
    VERBATIM
)
add_dependencies(copy-lib ${TARGET_NAME})
endif()

