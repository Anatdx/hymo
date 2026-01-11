# Android NDK toolchain file for CMake
# This file is for cross-compiling to Android

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

# Find the toolchain
set(ANDROID_TOOLCHAIN_PREFIX ${ANDROID_NDK}/toolchains/llvm/prebuilt/linux-x86_64)

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

# Set CMAKE_FIND_ROOT_PATH
set(CMAKE_FIND_ROOT_PATH ${ANDROID_NDK}/toolchains/llvm/prebuilt/linux-x86_64/sysroot)

set(CMAKE_FIND_ROOT_PATH_MODE_PROGRAM NEVER)
set(CMAKE_FIND_ROOT_PATH_MODE_LIBRARY ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_INCLUDE ONLY)
set(CMAKE_FIND_ROOT_PATH_MODE_PACKAGE ONLY)
