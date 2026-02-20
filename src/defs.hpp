// Constants and definitions (minimal lib)
#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace hymo {

#define HYMO_DATA_DIR "/data/adb/hymo"

constexpr const char* BASE_DIR = HYMO_DATA_DIR "/";
constexpr const char* RUN_DIR = HYMO_DATA_DIR "/run/";
constexpr const char* STATE_FILE = HYMO_DATA_DIR "/run/daemon_state.json";
constexpr const char* LKM_KO = "/data/adb/modules/hymo/hymofs_lkm.ko";
constexpr const char* LKM_AUTOLOAD_FILE = HYMO_DATA_DIR "/lkm_autoload";
constexpr const char* USER_HIDE_RULES_FILE = HYMO_DATA_DIR "/user_hide_rules";

constexpr const char* DISABLE_FILE_NAME = "disable";
constexpr const char* REMOVE_FILE_NAME = "remove";
constexpr const char* SKIP_MOUNT_FILE_NAME = "skip_mount";

constexpr const char* SELINUX_XATTR = "security.selinux";
constexpr const char* DEFAULT_SELINUX_CONTEXT = "u:object_r:system_file:s0";
constexpr const char* VENDOR_SELINUX_CONTEXT = "u:object_r:vendor_file:s0";

// Standard Android partitions
const std::vector<std::string> BUILTIN_PARTITIONS = {"system",     "vendor", "product",
                                                     "system_ext", "odm",    "oem"};

// KSU IOCTLs
constexpr uint32_t KSU_INSTALL_MAGIC1 = 0xDEADBEEF;
constexpr uint32_t KSU_INSTALL_MAGIC2 = 0xCAFEBABE;
constexpr uint32_t KSU_IOCTL_NUKE_EXT4_SYSFS = 0x40004b11;
constexpr uint32_t KSU_IOCTL_ADD_TRY_UMOUNT = 0x40004b12;

// HymoFS Devices
constexpr const char* HYMO_MIRROR_DEV = "/dev/hymo_mirror";

}  // namespace hymo
