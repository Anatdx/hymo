# **Hymo**

![Language](https://img.shields.io/badge/Language-C++-blue?style=flat-square&logo=cplusplus)
![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)
![Version](https://img.shields.io/badge/Version-v0.3.0-green?style=flat-square)

> 用于 KernelSU/Magisk 的混合挂载元模块，通过原生 C++ 二进制文件实现 OverlayFS 和 Magic Mount 逻辑。

---

<div align="center">

**[ 🇺🇸 English ](README.md)**

</div>

---

## **核心架构**

### 本项目基于[Meta-Hybrid Mount](https://github.com/YuzakiKokuban/meta-hybrid_mount)修改而来，使用C++重构了核心代码

* **真·混合引擎**:
  * **实现**: 使用 C++ 编写，通过直接 Linux 系统调用（fsopen、fsconfig、fsmount）实现强大的 OverlayFS 支持。
  * **机制**: 智能结合 **OverlayFS** 和 **Magic Mount**。优先使用 OverlayFS 以保证性能，对于不支持的情况或特定模块配置，自动回退到 Magic Mount。
  * **兼容性**: 完美支持现代 Android 分区结构，能够自动解析软链接分区（如 `/vendor` -> `/system/vendor`），确保在 Treble 设备上 OverlayFS 能正常生效。

* **智能同步**:
  * **性能**: 引入了开机增量同步机制。不再每次开机都清空重写，而是通过对比 `module.prop` 检测变化。
  * **速度**: 仅同步更新或新增的模块，大幅减少 I/O 占用，显著提升开机速度。

* **智能存储**:
  * **优先级**: 优先使用 **Tmpfs**（内存文件系统），实现最快的速度和最好的隐蔽性。
  * **回退机制**: 自动检测 Tmpfs 是否支持 XATTR（SELinux 必须）。如果不支持，则自动回退到挂载 2GB 的 ext4 loop 镜像 (`modules.img`)。

* **隐藏机制**:
  * **Nuke LKM**: 集成内核模块 (`nuke.ko`)，在使用 Ext4 模式时自动注销 sysfs 中的 `ext4` 节点，消除挂载痕迹（肉垫模式）。
  * **命名空间分离**: 实现了 `try_umount` 逻辑，在全局命名空间中分离挂载点，降低被检测风险。

## **特性**

* **逐模块配置**: 可通过 WebUI 将特定模块在 "自动" (OverlayFS) 和 "Magic" (绑定挂载) 模式间切换。
* **WebUI**: 基于 Svelte 5 + Vite 的现代化前端。支持配置 **隐蔽模式**（强制 Ext4、启用 Nuke LKM）及查看实时状态。
* **日志**: 位于 `/data/adb/hymo/daemon.log` 的标准化日志，格式清晰，便于 WebUI 过滤查看。
