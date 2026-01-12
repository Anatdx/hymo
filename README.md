# Hymo - Advanced Hybrid Mounting Solution for Android

![Language](https://img.shields.io/badge/Language-C++-00599C?style=flat-square&logo=cplusplus)
![Platform](https://img.shields.io/badge/Platform-Android%20(KernelSU)-3DDC84?style=flat-square&logo=android)
![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)

> **Hymo** represents an experimental approach to Android module management through KernelSU. Built from scratch in native C++, it leverages HymoFS technology to intercept kernel filesystem operations via VFS layer manipulation. **Warning**: This deep system integration carries inherent stability risks.

---
**[ 🇨🇳 中文 ](docs/README_ZH.md)**

## Technical Overview

Hymo operates as a system-level daemon that manages sophisticated mounting operations. While powerful, this architecture may conflict with certain system configurations.

### 1. C++ Native Implementation
*   **Pure Native Code**: Built entirely in C++ to eliminate shell scripting overhead, though this creates platform-specific binary dependencies.
*   **Low-Level System Integration**: Leverages modern Linux mount APIs (`fsopen`, `fsconfig`, `fsmount`, `move_mount`) for direct kernel interaction. Bypassing conventional mount utilities means missing their safety checks.
*   **Boot Performance**: Despite optimization efforts, daemon initialization necessarily extends boot sequences and may impact device startup times.

### 2. Adaptive Mount Strategy
The module implements a **three-tier mounting system** centered around HymoFS:
*   **HymoFS Mode (Kernel-Level)**: Operates through kernel source modifications that expose custom VFS hooks. Directly intercepts filesystem calls for file redirection. This kernel-space operation poses significant stability and data integrity risks.
*   **OverlayFS Mode (Standard)**: Employs kernel's built-in OverlayFS capabilities for transparent file layering without kernel modifications.
*   **Magic Mount Mode (Legacy)**: Traditional bind mounting mechanism for backwards compatibility with older kernels or restricted partitions.
*   **Intelligent Selection**: Runtime environment detection automatically chooses the optimal mode, with manual override available through the web interface.

### 3. Smart Synchronization
*   **Delta Detection**: Compares `module.prop` metadata and file modification timestamps during initialization to identify changes.
*   **Selective Sync**: Only transfers modified files to the working environment. While this minimizes write operations, the comparison overhead itself consumes I/O cycles and contributes to flash wear.

### 4. Flexible Storage Architecture
*   **Runtime Storage**: Automatically detects kernel Tmpfs availability. Memory-backed storage improves performance but consumes RAM, potentially triggering OOM on memory-constrained devices.
*   **Volatile Workspace**: Module images reside in tmpfs during runtime, discarded on reboot for security and cleanliness.
*   **Persistent Fallback**: Systems without tmpfs support utilize `modules.img` loop-mounted ext4 images, trading performance for persistent storage.

---

## Building from Source

Hymo utilizes a **CMake + Ninja** toolchain for efficient cross-platform compilation.

**System Requirements**:
*   CMake 3.22 or newer
*   Ninja build generator
*   Android NDK r25 or later
*   Node.js runtime with npm (for web interface compilation)

### Getting Started

```bash
# Initialize build configuration
./build.sh init

# Full compilation (all target architectures + web UI)
./build.sh all
```

### Available Build Targets

```bash
./build.sh init       # Configure build environment
./build.sh all        # Compile all architecture variants
./build.sh testzip    # Generate test package (ARM64 only)
./build.sh package    # Build complete flashable module
./build.sh clean      # Remove build artifacts
./build.sh help       # Display available commands
```

**Full Build Documentation**: Comprehensive instructions available in [docs/BUILD.md](docs/BUILD.md)

### HymoFS Kernel Integration

HymoFS ships with an automated `setup.sh` installer for seamless kernel source integration.

> **Important Notice:** **HymoFS has officially merged with YukiSU.**
>
> *   **YukiSU Exclusive Support**: Currently only supported for use with YukiSU Manager; other managers are no longer supported.
> *   **SUSFS Incompatibility**: HymoFS no longer supports SUSFS and is mutually exclusive with it. Do not attempt to coexist.
> *   **Changelog**: Recent updates include low-level code cleanup and optimization, build fixes, and WebUI dependency upgrades (React 19 adaptation) to improve overall stability.

**Automated Installation**:
```bash
curl -LSs https://raw.githubusercontent.com/Anatdx/HymoFS/main/setup.sh | bash -s defconfig arch/arm64/configs/gki_defconfig
```

**Integration Capabilities**:
*   **Version Detection**: Automatically identifies kernel version (6.1/6.6 series) and selects appropriate patch branch. May misidentify heavily modified kernels.
*   **KernelSU Discovery**: Scans for existing KernelSU integration.

**Deployment**:
Flash the generated ZIP through KernelSU Manager. Compatibility depends on your manager version.

---

## Command-Line Interface

The `hymod` utility provides direct access to daemon operations and HymoFS rule management.

### Synopsis
```bash
hymod [OPTIONS] [COMMAND]
```

### Available Commands
*   `mount`: Trigger module mounting sequence (default behavior)
*   `modules`: Display currently active module inventory
*   `storage`: Report storage backend status
*   `reload`: Force HymoFS mapping refresh
*   `clear`: Purge all HymoFS rules (recovery operation for unstable systems)
*   `list`: Enumerate active kernel-level HymoFS mappings
*   `version`: Display HymoFS protocol version
*   `gen-config`: Generate default configuration template
*   `show-config`: Print active configuration
*   `add <mod_id>`: Inject module rules manually
*   `delete <mod_id>`: Remove module rules manually
*   `set-mirror <path>`: Configure custom mirror location
*   `raw <cmd> ...`: Direct HymoFS kernel interface access. **Critical Warning: Incorrect usage causes immediate system failure**

### Configuration Options
*   `-c, --config FILE`: Load alternative configuration file
*   `-m, --moduledir DIR`: Override module directory path
*   `-v, --verbose`: Activate detailed logging output
*   `-p, --partition NAME`: Include additional partition in scan

---

## Acknowledgments

*   **KernelSU Project**: Foundation for root-level access management
*   **LLVM libc++**: C++ standard library implementation for Android
*   **Community Testers**: Valuable feedback and early adoption

---

> **⚠️ Critical Warning**: This software performs invasive kernel-level modifications. **Permanent data loss is a realistic outcome.** Always maintain current backups before installation. The author accepts zero liability for device damage, data corruption, boot failures, or any other consequences resulting from use of this module.
