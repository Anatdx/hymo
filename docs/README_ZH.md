# Hymo - Android 高级混合挂载解决方案

![Language](https://img.shields.io/badge/Language-C++-00599C?style=flat-square&logo=cplusplus)
![Platform](https://img.shields.io/badge/Platform-Android%20(KernelSU)-3DDC84?style=flat-square&logo=android)
![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)

> **Hymo** 是针对 KernelSU 的实验性模块管理方案。完全使用原生 C++ 重新实现，通过 HymoFS 技术在 VFS 层面拦截内核文件系统操作。**警告**：这种深度系统集成存在固有的稳定性风险。

---
**[ 🇺🇸/🇬🇧 English ](../README.md)**

## 技术架构概览

Hymo 作为系统级守护进程运行，负责管理复杂的挂载操作。虽然功能强大，但这种架构可能与某些系统配置产生冲突。

### 1. C++ 原生实现
*   **纯原生代码**：完全采用 C++ 构建以消除 Shell 脚本开销
*   **底层系统集成**：利用现代 Linux 挂载 API（`fsopen`、`fsconfig`、`fsmount`、`move_mount`）直接与内核交互。
*   **启动性能**：尽管经过优化，守护进程初始化必然会延长启动序列，可能影响设备开机时间。

### 2. 自适应挂载策略
模块实现了以 HymoFS 为核心的**三层挂载系统**：
*   **HymoFS 模式（内核级）**：通过内核源码修改暴露自定义 VFS 钩子来运行。直接拦截文件系统调用以实现文件重定向。这种内核空间操作可能带来显著的性能问题。
*   **OverlayFS 模式（标准）**：利用内核内置的 OverlayFS 功能实现透明文件分层，无需修改内核。
*   **Magic Mount 模式（传统）**：使用传统的绑定挂载机制，用于向后兼容旧内核或受限分区。
*   **智能选择**：运行时环境检测自动选择最优模式，也可通过 Web 界面手动覆盖。

### 3. 智能同步机制
*   **增量检测**：初始化期间比对 `module.prop` 元数据和文件修改时间戳以识别变更。
*   **选择性同步**：仅传输已修改的文件到工作环境。虽然这最小化了写入操作，但比对过程本身也会消耗 I/O 周期并加剧闪存磨损。

### 4. 灵活存储架构
*   **运行时存储**：自动检测内核 Tmpfs 可用性。内存支持的存储提升性能但消耗 RAM，在内存受限设备上可能触发 OOM。
*   **易失性工作区**：模块镜像在运行时驻留于 tmpfs，重启后丢弃以保证安全性和清洁性。
*   **持久性回退**：不支持 tmpfs 的系统使用 `modules.img` 环回挂载的 ext4 镜像，以持久存储换取性能。

---

## 源码编译构建

Hymo 采用 **CMake + Ninja** 工具链实现高效跨平台编译。

**系统依赖**：
*   CMake 3.22 或更新版本
*   Ninja 构建生成器
*   Android NDK r25 或更高版本
*   Node.js 运行时及 npm（用于编译 Web 界面）

### 快速开始

```bash
# 初始化构建配置
./build.sh init

# 完整编译（所有目标架构 + Web UI）
./build.sh all
```

### 可用构建目标

```bash
./build.sh init       # 配置构建环境
./build.sh all        # 编译所有架构变体
./build.sh testzip    # 生成测试包（仅 ARM64）
./build.sh package    # 构建完整可刷写模块
./build.sh clean      # 清理构建产物
./build.sh help       # 显示可用命令
```

**完整构建文档**：详细说明请参阅 [docs/BUILD.md](docs/BUILD.md)

### HymoFS 内核集成

HymoFS 提供自动化的 `setup.sh` 安装程序，可无缝集成到内核源码。

> **重要通知:** **HymoFS 现已正式与 YukiSU 合并**。
> 
> *   **YukiSU 独占支持**：目前仅支持配合 YukiSU 管理器使用，不再支持其他管理器。
> *   **SUSFS 互斥**：HymoFS 不再支持 SUSFS，且两者存在冲突，请勿尝试共存。
> *   **变更日志**：近期对项目进行了底层代码清理与优化，修复了构建问题，并升级了 WebUI 依赖（适配 React 19），提升了整体稳定性。

**自动化安装**：
```bash
curl -LSs https://raw.githubusercontent.com/Anatdx/HymoFS/main/setup.sh | bash -s defconfig arch/arm64/configs/gki_defconfig
```

**集成能力**：
*   **版本检测**：自动识别内核版本（6.1/6.6 系列）并选择合适的补丁分支。可能误判深度修改的内核。
*   **KernelSU 发现**：扫描现有的 KernelSU 集成。

**部署方式**：
通过 KernelSU Manager 刷入生成的 ZIP。兼容性取决于您的管理器版本。

---

## 命令行界面

`hymod` 工具提供对守护进程操作和 HymoFS 规则管理的直接访问。

### 语法
```bash
hymod [选项] [命令]
```

### 可用命令
*   `mount`: 触发模块挂载序列（默认行为）
*   `modules`: 显示当前活跃的模块清单
*   `storage`: 报告存储后端状态
*   `reload`: 强制刷新 HymoFS 映射
*   `clear`: 清除所有 HymoFS 规则（用于不稳定系统的恢复操作）
*   `list`: 枚举活跃的内核级 HymoFS 映射
*   `version`: 显示 HymoFS 协议版本
*   `gen-config`: 生成默认配置模板
*   `show-config`: 打印活跃配置
*   `add <mod_id>`: 手动注入模块规则
*   `delete <mod_id>`: 手动移除模块规则
*   `set-mirror <path>`: 配置自定义镜像位置
*   `raw <cmd> ...`: 直接访问 HymoFS 内核接口。**严重警告：错误使用会导致系统立即失效**

### 配置选项
*   `-c, --config FILE`: 加载备用配置文件
*   `-m, --moduledir DIR`: 覆盖模块目录路径
*   `-v, --verbose`: 激活详细日志输出
*   `-p, --partition NAME`: 在扫描中包含额外分区

---

## 致谢

*   **KernelSU 项目**：root 级访问管理的基础框架
*   **LLVM libc++**：Android 平台的 C++ 标准库实现
*   **社区测试者**：宝贵的反馈和早期采用

---

> **⚠️ 严重警告**：本软件执行侵入性的内核级修改。**永久性数据丢失是现实可能的结果。** 安装前务必保持最新备份。作者对因使用本模块导致的设备损坏、数据损坏、启动失败或任何其他后果不承担任何责任。
