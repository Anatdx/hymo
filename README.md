# Hymo - 下一代 Android 混合挂载引擎

![Language](https://img.shields.io/badge/Language-C++17-00599C?style=flat-square&logo=cplusplus)
![Platform](https://img.shields.io/badge/Platform-Android%20(KernelSU%2FMagisk)-3DDC84?style=flat-square&logo=android)
![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)

> **Hymo** 是一个专为 KernelSU 和 Magisk 设计的高性能混合挂载（Hybrid Mount）元模块。它采用原生 C++ 重构核心逻辑，通过直接系统调用（Syscalls）实现了稳健的 OverlayFS 与 Magic Mount 混合挂载机制，旨在提供极致的性能、兼容性与隐藏性。

---

## 核心架构 (Core Architecture)

Hymo 不仅仅是一个挂载脚本，它是一个完整的原生守护进程（Daemon），旨在解决传统 Shell 脚本在复杂挂载场景下的性能瓶颈与兼容性问题。

### 1. 原生 C++ 引擎
*   **高性能**：核心逻辑完全由 C++17 编写，摒弃了低效的 Shell 脚本调用。
*   **直接系统调用**：直接使用 `fsopen`, `fsconfig`, `fsmount`, `move_mount` 等现代 Linux Mount API，绕过 `mount` 命令行的限制，提供更精细的挂载控制。
*   **极速启动**：优化的执行流程使得模块加载几乎不增加系统启动时间。

### 2. 智能混合挂载 (True Hybrid Engine)
Hymo 采用“OverlayFS 优先，Magic Mount 兜底”的策略：
*   **OverlayFS 模式**：默认使用 OverlayFS 将模块文件层叠在系统分区上，实现文件级别的合并与覆盖，性能损耗极低。
*   **Magic Mount 回退**：对于不支持 OverlayFS 的旧内核或特定分区，自动降级为传统的 Bind Mount（Magic Mount）模式。
*   **动态决策**：支持通过 WebUI 对单个模块进行挂载模式配置（Auto/Magic）。

### 3. 智能同步 (Smart Sync)
*   **增量更新**：启动时自动比对模块的 `module.prop` 和文件时间戳。
*   **零冗余 IO**：仅同步发生变更的模块文件到工作目录，大幅减少启动时的 I/O 压力，延长闪存寿命。

### 4. 弹性存储后端 (Smart Storage)
*   **Tmpfs 优先**：默认尝试在内存文件系统（Tmpfs）中构建模块镜像，速度最快且重启即焚（高隐藏性）。
*   **Ext4 镜像回退**：如果检测到 Tmpfs 不支持 XATTR（SELinux 上下文所需），自动回退到挂载 2GB 的 `modules.img` 环回镜像，确保权限正确。

---

## 技术亮点与突破 (Technical Highlights)

### 🛡️ 完美的 SystemUI 兼容性修复
针对 Android 现代分区布局（Treble/SAR）中存在的复杂软链接问题（如 `/system/vendor` -> `/vendor`），Hymo 实现了独有的**分区修复逻辑**：
*   **问题**：传统 OverlayFS 挂载会覆盖系统分区的软链接，导致 `/system/vendor` 变成普通目录，丢失原系统库文件，引发 SystemUI 崩溃（`NoClassDefFoundError`）。
*   **解决方案**：Hymo 在挂载 Overlay 后，会自动检测并执行 **"Symlink Restoration"**，将底层的 `/vendor`, `/product`, `/system_ext` 等分区重新 Bind Mount 到 Overlay 层之上，完美修复系统文件可见性，彻底解决崩溃问题。

### 👻 极致隐藏 (Stealth Mode)
*   **命名空间分离**：利用 `unshare` 和 `mount --make-private` 技术，尽可能将挂载痕迹限制在特定命名空间内。
*   **Nuke LKM 集成**：(可选) 集成内核模块以移除 Ext4 镜像挂载产生的 Sysfs 痕迹，防止被检测手段通过 `/sys/fs/ext4` 发现。
*   **挂载点清理**：启动完成后自动卸载无用的中间挂载点，保持挂载表（Mountinfo）干净。

### 🖥️ 现代化 WebUI
*   **技术栈**：基于 Svelte 5 + Vite 构建的现代化前端。
*   **功能**：
    *   实时查看存储空间使用率。
    *   单模块挂载模式切换（Overlay/Magic）。
    *   查看详细的守护进程日志。
    *   一键清理缓存与重置配置。

---

## 目录结构 (Project Structure)

```text
hymo/
├── src/                # C++ 核心源码
│   ├── core/           # 核心逻辑 (Executor, Planner, Sync, Storage)
│   ├── mount/          # 挂载实现 (OverlayFS, Magic Mount)
│   └── conf/           # 配置解析
├── module/             # Magisk/KSU 模块模板
│   ├── customize.sh    # 安装脚本
│   └── webroot/        # WebUI 静态资源
├── webui/              # Svelte 前端源码
└── Makefile            # 多架构编译系统
```

## 编译与安装 (Build & Install)

Hymo 使用标准的 Makefile 构建系统，支持交叉编译。

**前置要求**：
*   Android NDK (r25+)
*   Node.js & npm (用于构建 WebUI)
*   Make & Zip

**编译命令**：
```bash
# 编译所有架构并打包
make zip

# 仅编译 arm64 并生成测试包
make testzip
```

**安装**：
生成的 zip 包可直接在 KernelSU 或 Magisk Manager 中刷入。

---

## 致谢 (Credits)

*   **Meta-Hybrid Mount**: 本项目的灵感来源与原型基础。
*   **KernelSU & Magisk**: 强大的 Root 解决方案。
*   **Libcxx**: Android NDK C++ 标准库。

---

> **免责声明**: 本项目涉及系统底层修改，请在确保数据备份的前提下使用。开发者不对因使用本模块导致的任何数据丢失或设备损坏负责。
