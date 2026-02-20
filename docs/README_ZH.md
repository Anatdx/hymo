# Hymo

![Language](https://img.shields.io/badge/Language-C++-00599C?style=flat-square&logo=cplusplus)
![Platform](https://img.shields.io/badge/Platform-Android-3DDC84?style=flat-square&logo=android)
![License](https://img.shields.io/badge/License-GPL--3.0-blue?style=flat-square)

KernelSU 的 C++ 模块管理器，支持 HymoFS、OverlayFS 和 Magic Mount。

**[🇺🇸/🇬🇧 English](../README.md)**

---

## 功能

- **多种挂载模式**：HymoFS（需要内核补丁）、OverlayFS、Magic Mount
- **网页界面**：浏览器管理模块（React + TypeScript）
- **智能存储**：优先使用 tmpfs，不可用时回退到 ext4 镜像
- **原生性能**：C++ 编写，使用现代 Linux 挂载 API

---

## 安装

1. 从 [Releases](https://github.com/KernelSU-Modules-Repo/hymo/releases) 下载 ZIP
2. 通过 KernelSU Manager 刷入
3. 重启

---

## 编译

```bash
./build.sh init      # 初始化
./build.sh all       # 编译所有架构
./build.sh package   # 生成刷机包
```

**需要**：CMake 3.22+、Android NDK r25+、Node.js（编译 WebUI）

---

## HymoFS 内核补丁

启用 HymoFS 模式需要给内核打补丁：

```bash
curl -LSs https://raw.githubusercontent.com/Anatdx/HymoFS/main/setup.sh | bash -s defconfig arch/arm64/configs/gki_defconfig
```

自动检测内核版本（6.1/6.6/6.12）并应用补丁。

## HymoFS KPM

正在开发中……

---

## 命令行

```bash
hymod mount                          # 挂载模块
hymod modules                        # 列出模块
hymod set-mode <id> <mode>          # 设置挂载模式 (auto/hymofs/overlay/magic/none)
hymod hymofs <on|off>               # 开关 HymoFS
hymod stealth <on|off>              # 开关隐身模式
```

配置文件：`/data/adb/hymo/config.json`

---

## 许可证

GPL-3.0

## 感谢

本项目参考/使用了以下开源项目与工具（排名不分先后）：

- [KernelSU](https://kernelsu.org)
- [Magisk](https://github.com/topjohnwu/Magisk)
- [susfs4ksu](https://gitlab.com/simonpunk/susfs4ksu)
- [KernelPatch](https://github.com/bmax121/KernelPatch)
- [meta-hybrid_mount](https://github.com/Hybrid-Mount/meta-hybrid_mount)
- [meta-magic_mount](https://codeberg.org/ovo/meta-magic_mount)
- [meta-magic_mount_rs](https://github.com/Tools-cx-app/meta-magic_mount/)
- [mountify](https://github.com/backslashxx/mountify)
- [meta-overlayfs](https://github.com/KernelSU-Modules-Repo/meta-overlayfs)
- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Zustand](https://github.com/pmndrs/zustand)
- [Lucide Icons](https://lucide.dev)
