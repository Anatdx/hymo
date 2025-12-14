# Hymo - Next Generation Android Hybrid Mount Engine

![Language](https://img.shields.io/badge/Language-C++-00599C?style=flat-square&logo=cplusplus)
![Platform](https://img.shields.io/badge/Platform-Android%20(KernelSU)-3DDC84?style=flat-square&logo=android)
![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)

> **Hymo** is a high-performance hybrid mount meta-module designed for KernelSU. It refactors core logic with native C++ and introduces HymoFS, which hijacks the kernel file system to use VFS mapping directly instead of mounting, achieving a realistic mounting effect.

---
**[ 🇨🇳 中文 ](docs/README_ZH.md)**

## Core Architecture

Hymo is not just a mount script; it is a complete native daemon designed to solve performance bottlenecks and compatibility issues of traditional shell scripts in complex mounting scenarios.

### 1. Native C++ Engine
*   **High Performance**: Core logic is written entirely in C++, discarding inefficient Shell script calls.
*   **Direct System Calls**: Uses modern Linux Mount APIs like `fsopen`, `fsconfig`, `fsmount`, `move_mount` directly, bypassing `mount` command-line limitations for finer mount control.
*   **Blazing Fast Startup**: Optimized execution flow ensures module loading adds almost no overhead to system boot time.

### 2. HymoFS & Multi-Mode Engine
Hymo introduces proprietary **HymoFS** technology, building a three-tier mount strategy:
*   **HymoFS (Kernel Mode)**: Opens a kernel interface after patching the kernel source, directly hijacking the underlying file system to implement file mapping instead of mounting, allowing for hot recovery.
*   **OverlayFS (General Mode)**: The preferred solution in standard environments, utilizing kernel OverlayFS features for file-level merging.
*   **Magic Mount (Compatibility Mode)**: A traditional Bind Mount fallback for old kernels or special partitions.
*   **Dynamic Decision**: The daemon automatically detects the environment to select the best mode, or users can force a specific mode via WebUI.

### 3. Smart Sync
*   **Incremental Update**: Automatically compares module `module.prop` and file timestamps at startup.
*   **Zero Redundant I/O**: Only synchronizes changed module files to the working directory, significantly reducing I/O pressure during startup and extending flash memory life.

### 4. Smart Storage Backend
*   **Smart Space Management**: Automatically detects kernel Tmpfs support during installation. If supported, it skips creating Ext4 images and uses the in-memory file system directly, saving user storage space.
*   **Tmpfs Priority**: Prioritizes building module images in memory at runtime, offering the fastest speed and "burn after reboot" (high stealth).
*   **Ext4 Image Fallback**: Automatically falls back to `modules.img` loopback image only when the kernel does not support Tmpfs, ensuring functional availability.

---

## Build & Install

Hymo uses a standard Makefile build system and supports cross-compilation.

**Prerequisites**:
*   Android NDK (r25+)
*   Node.js & npm (for building WebUI)
*   Make & Zip

**HymoFS Patch**

If you need to use HymoFS, please add the following to your compilation script when compiling the kernel:
```bash
wget https://raw.githubusercontent.com/Anatdx/HymoFS/refs/heads/android15_6.6/patch/hymofs.patch
patch -p1 -F 3 < hymofs.patch
echo "CONFIG_HYMOFS=y" >> ./common/arch/arm64/configs/gki_defconfig # Write to defconfig
```
Or if you are using susfs, add this **AFTER** the susfs patch：
```bash
wget https://raw.githubusercontent.com/Anatdx/HymoFS/refs/heads/android_15_6.6/patch/hymofs_with_susfs.patch
patch -p1 -F 3 < yhymofs_with_susfs.patch
echo "CONFIG_HYMOFS=y" >> ./common/arch/arm64/configs/gki_defconfig # Write to defconfig
```
**Build Commands**:
```bash
# Compile all architectures and package
make zip

# Compile arm64 only and generate test package
make testzip
```

**Install**:
The generated zip package can be flashed directly in KernelSU Manager.

---

## CLI Usage (hymod)

Hymo comes with a powerful command-line tool `hymod` for managing the daemon and HymoFS rules.

### Basic Usage
```bash
hymod [OPTIONS] [COMMAND]
```

### Commands
*   `mount`: Mount all modules (Default action).
*   `modules`: List all active modules.
*   `storage`: Show current storage status (Tmpfs/Ext4).
*   `reload`: Reload HymoFS mappings (scans for changes).
*   `clear`: Clear all HymoFS mappings (Emergency Reset).
*   `list`: List all active HymoFS kernel rules.
*   `version`: Show HymoFS protocol and config version.
*   `gen-config`: Generate a default configuration file.
*   `show-config`: Display the current configuration.
*   `add <mod_id>`: Manually add a specific module's rules.
*   `delete <mod_id>`: Manually remove a specific module's rules.
*   `raw <cmd> ...`: Execute raw HymoFS low-level commands (add/hide/inject/delete).

### Options
*   `-c, --config FILE`: Specify a custom config file path.
*   `-m, --moduledir DIR`: Specify the module directory (default: `/data/adb/modules`).
*   `-v, --verbose`: Enable verbose logging for debugging.
*   `-p, --partition NAME`: Add a partition to scan (can be used multiple times).

---

## Credits

*   **[Meta-Hybrid Mount](https://github.com/YuzakiKokuban/meta-hybrid_mount)**: Inspiration and prototype basis for this project.
*   **KernelSU**: Powerful Root solutions.
*   **Libcxx**: Android NDK C++ standard library.
*   **All contributors to this project**: Thank you for your efforts.

---

> **Disclaimer**: This project involves low-level system modifications. Please ensure data backup before use. The developer is not responsible for any data loss or device damage caused by using this module.
