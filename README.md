# **Meta-Hybrid Mount**

![Language](https://img.shields.io/badge/Language-Rust-orange?style=flat-square&logo=rust)
![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)
![Version](https://img.shields.io/badge/Version-v0.2.8--r4-green?style=flat-square)

> A Hybrid Mount metamodule for KernelSU/Magisk, implementing both OverlayFS and Magic Mount logic via a native Rust binary.

---

<div align="center">

**[ 🇨🇳 中文 (Chinese) ](README_ZH.md)**

</div>

---

## **Core Architecture**

* **True Hybrid Engine**:
  * **Logic**: Written in Rust using `rustix` for direct syscalls, ensuring high performance and safety.
  * **Mechanism**: Intelligently mixes **OverlayFS** and **Magic Mount**. It prioritizes OverlayFS for performance but automatically falls back to Magic Mount for specific modules or partitions if needed.
  * **Compatibility**: Fully supports modern Android partition layouts, including resolving symlinked partitions (e.g., `/vendor` -> `/system/vendor`) to ensure OverlayFS works correctly on Treble devices.

* **Smart Sync (New)**:
  * **Performance**: Implements an incremental synchronization strategy on boot. Instead of wiping and re-copying everything, it checks for changes in `module.prop`.
  * **Speed**: Only modified or new modules are synced, drastically reducing boot time I/O overhead.

* **Smart Storage**:
  * **Priority**: Prioritizes **Tmpfs** (memory-backed filesystem) for maximum speed and stealth.
  * **Fallback**: Automatically detects if Tmpfs supports XATTR (required for SELinux). If not, it safely falls back to mounting a 2GB ext4 loop image (`modules.img`).

* **Stealth**:
  * **Nuke LKM**: Integrates a kernel module (`nuke.ko`) to unregister `ext4` sysfs nodes when using image mode, erasing traces of the loop mount (Paw Pad mode).
  * **Namespace Detach**: Implements `try_umount` logic to detach mount points in the global namespace, making them invisible to other processes where possible.

## **Features**

* **Per-Module Configuration**: Toggle specific modules between "Auto" (OverlayFS) and "Magic" (Bind Mount) modes via WebUI.
* **WebUI**: A Svelte 5 + Vite frontend running in WebView. Includes settings for **Stealth Mode** (Force Ext4, Enable Nuke LKM) and real-time status monitoring.
* **Logging**: Standardized, distinct daemon logs at `/data/adb/meta-hybrid/daemon.log` (optimized for WebUI filtering).