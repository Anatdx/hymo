#include "hymofs.hpp"
#include <fcntl.h>
#include <sys/ioctl.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>
#include <cstdlib>
#include <cstdio>
#include <cerrno>
#include <cstring>
#include "../utils.hpp"
#include "hymo_magic.h"

namespace hymo {

static HymoFSStatus s_cached_status = HymoFSStatus::NotPresent;
static bool s_status_checked = false;
static int s_hymo_fd = -1;  // Cached anonymous fd
static int s_last_errno = 0;

static int get_anon_fd_legacy() {
    // Request anonymous fd from kernel via GET_FD syscall
    int fd = syscall(SYS_reboot, HYMO_MAGIC1, HYMO_MAGIC2, HYMO_CMD_GET_FD, 0);
    if (fd < 0) {
        s_last_errno = errno;
        LOG_ERROR("Failed to get HymoFS anonymous fd: " + std::string(strerror(errno)));
        if (errno == EINVAL) {
            LOG_ERROR("Hint: got EINVAL. This usually means hymofs_kpm reboot hook is NOT active "
                      "(KPM not loaded yet / not ready).");
        }
        return -1;
    }

    s_hymo_fd = fd;
    s_last_errno = 0;
    LOG_INFO("HymoFS: Got anonymous fd " + std::to_string(fd));
    return fd;
}

static int get_anon_fd_with_mask(uint64_t mask) {
    // mask is passed as an immediate value in the syscall arg register
    int fd = syscall(SYS_reboot, HYMO_MAGIC1, HYMO_MAGIC2, HYMO_CMD_GET_FD_WITH_MASK,
                     (void*)(uintptr_t)mask);
    if (fd < 0) {
        s_last_errno = errno;
        LOG_ERROR("Failed to bootstrap HymoFS fd with mask: " + std::string(strerror(errno)));
        if (errno == EINVAL) {
            LOG_ERROR("Hint: got EINVAL. This usually means hymofs_kpm reboot hook is NOT active "
                      "(KPM not loaded yet / not ready).");
        }
        return -1;
    }

    s_hymo_fd = fd;
    s_last_errno = 0;
    {
        char buf[32];
        snprintf(buf, sizeof(buf), "%llx", (unsigned long long)mask);
        LOG_INFO("HymoFS: Bootstrapped anonymous fd " + std::to_string(fd) + " (mask=0x" +
                 std::string(buf) + ")");
    }
    return fd;
}

// Get anonymous fd from kernel (only way to communicate with HymoFS)
static int get_anon_fd() {
    if (s_hymo_fd >= 0) {
        return s_hymo_fd;
    }

    // Optional env override for ad-hoc bootstrap (e.g. HYMO_HOOK_MASK=0x3ff hymod hymofs version)
    const char* env_mask = getenv("HYMO_HOOK_MASK");
    if (env_mask && *env_mask) {
        char* endp = nullptr;
        errno = 0;
        unsigned long long val = strtoull(env_mask, &endp, 0);
        if (errno == 0 && endp && endp != env_mask) {
            return get_anon_fd_with_mask((uint64_t)val);
        }
    }

    return get_anon_fd_legacy();
}

// Execute command via anonymous fd ioctl (recommended: unified HYMO_IOC_CALL)
static int hymo_execute_cmd(uint32_t cmd, void* arg) {
    int fd = get_anon_fd();
    if (fd < 0) {
        return -1;
    }

    struct hymo_ioctl_call call = {
        .cmd = cmd,
        .reserved = 0,
        .arg = (uint64_t)(uintptr_t)arg,
    };

    int ret = ioctl(fd, HYMO_IOC_CALL, &call);
    if (ret < 0) {
        LOG_ERROR("HymoFS ioctl failed: " + std::string(strerror(errno)));
    }
    return ret;
}

bool HymoFS::bootstrap_with_mask(uint64_t mask) {
    if (s_hymo_fd >= 0) {
        return true;
    }
    s_status_checked = false;  // force re-check after bootstrap
    return get_anon_fd_with_mask(mask) >= 0;
}

int HymoFS::last_errno() {
    return s_last_errno;
}

int HymoFS::get_protocol_version() {
    int fd = get_anon_fd();
    if (fd < 0) {
        return -1;
    }

    int version = 0;
    if (hymo_execute_cmd(HYMO_CMD_GET_VERSION, &version) == 0) {
        LOG_VERBOSE("get_protocol_version returned: " + std::to_string(version));
        return version;
    }

    LOG_ERROR("get_protocol_version failed: " + std::string(strerror(errno)));
    return -1;
}

HymoFSStatus HymoFS::check_status() {
    if (s_status_checked) {
        LOG_VERBOSE("HymoFS check_status: Cached (" + std::to_string((int)s_cached_status) + ")");
        return s_cached_status;
    }

    int k_ver = get_protocol_version();
    if (k_ver < 0) {
        LOG_WARN("HymoFS check_status: NotPresent (syscall failed)");
        s_cached_status = HymoFSStatus::NotPresent;
        s_status_checked = true;
        return HymoFSStatus::NotPresent;
    }

    if (k_ver < EXPECTED_PROTOCOL_VERSION) {
        LOG_WARN("HymoFS check_status: KernelTooOld (got " + std::to_string(k_ver) + ", expected " +
                 std::to_string(EXPECTED_PROTOCOL_VERSION) + ")");
        s_cached_status = HymoFSStatus::KernelTooOld;
        s_status_checked = true;
        return HymoFSStatus::KernelTooOld;
    }
    if (k_ver > EXPECTED_PROTOCOL_VERSION) {
        LOG_WARN("HymoFS check_status: ModuleTooOld (got " + std::to_string(k_ver) + ", expected " +
                 std::to_string(EXPECTED_PROTOCOL_VERSION) + ")");
        s_cached_status = HymoFSStatus::ModuleTooOld;
        s_status_checked = true;
        return HymoFSStatus::ModuleTooOld;
    }

    LOG_INFO("HymoFS check_status: Available (version " + std::to_string(k_ver) + ")");
    s_cached_status = HymoFSStatus::Available;
    s_status_checked = true;
    return HymoFSStatus::Available;
}

bool HymoFS::is_available() {
    return check_status() == HymoFSStatus::Available;
}

bool HymoFS::clear_rules() {
    LOG_INFO("HymoFS: Clearing all rules...");
    bool ret = hymo_execute_cmd(HYMO_CMD_CLEAR_ALL, nullptr) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: clear_rules failed: " + std::string(strerror(errno)));
    } else {
        LOG_INFO("HymoFS: clear_rules success");
    }
    return ret;
}

bool HymoFS::add_rule(const std::string& src, const std::string& target, int type) {
    struct hymo_syscall_arg arg = {.src = src.c_str(), .target = target.c_str(), .type = type};

    LOG_INFO("HymoFS: Adding rule src=" + src + ", target=" + target +
             ", type=" + std::to_string(type));
    bool ret = hymo_execute_cmd(HYMO_CMD_ADD_RULE, &arg) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: add_rule failed: " + std::string(strerror(errno)));
    }
    return ret;
}

bool HymoFS::add_merge_rule(const std::string& src, const std::string& target) {
    struct hymo_syscall_arg arg = {.src = src.c_str(), .target = target.c_str(), .type = 0};

    LOG_INFO("HymoFS: Adding merge rule src=" + src + ", target=" + target);
    bool ret = hymo_execute_cmd(HYMO_CMD_ADD_MERGE_RULE, &arg) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: add_merge_rule failed: " + std::string(strerror(errno)));
    }
    return ret;
}

bool HymoFS::delete_rule(const std::string& src) {
    struct hymo_syscall_arg arg = {.src = src.c_str(), .target = NULL, .type = 0};

    LOG_INFO("HymoFS: Deleting rule src=" + src);
    bool ret = hymo_execute_cmd(HYMO_CMD_DEL_RULE, &arg) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: delete_rule failed: " + std::string(strerror(errno)));
    }
    return ret;
}

bool HymoFS::set_mirror_path(const std::string& path) {
    struct hymo_syscall_arg arg = {.src = path.c_str(), .target = NULL, .type = 0};

    LOG_INFO("HymoFS: Setting mirror path=" + path);
    bool ret = hymo_execute_cmd(HYMO_CMD_SET_MIRROR_PATH, &arg) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: set_mirror_path failed: " + std::string(strerror(errno)));
    }
    return ret;
}

bool HymoFS::hide_path(const std::string& path) {
    struct hymo_syscall_arg arg = {.src = path.c_str(), .target = NULL, .type = 0};

    LOG_INFO("HymoFS: Hiding path=" + path);
    bool ret = hymo_execute_cmd(HYMO_CMD_HIDE_RULE, &arg) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: hide_path failed: " + std::string(strerror(errno)));
    }
    return ret;
}

bool HymoFS::add_rules_from_directory(const fs::path& target_base, const fs::path& module_dir) {
    if (!fs::exists(module_dir) || !fs::is_directory(module_dir))
        return false;

    try {
        for (const auto& entry : fs::recursive_directory_iterator(module_dir)) {
            const fs::path& current_path = entry.path();

            // Calculate relative path from module root
            fs::path rel_path = fs::relative(current_path, module_dir);
            fs::path target_path = target_base / rel_path;

            if (entry.is_regular_file() || entry.is_symlink()) {
                add_rule(target_path.string(), current_path.string());
            } else if (entry.is_character_file()) {
                // Redirection for whiteout (0:0)
                struct stat st;
                if (stat(current_path.c_str(), &st) == 0 && st.st_rdev == 0) {
                    hide_path(target_path.string());
                }
            }
        }
    } catch (const std::exception& e) {
        LOG_WARN("HymoFS rule generation error for " + module_dir.string() + ": " + e.what());
        return false;
    }
    return true;
}

bool HymoFS::remove_rules_from_directory(const fs::path& target_base, const fs::path& module_dir) {
    if (!fs::exists(module_dir) || !fs::is_directory(module_dir))
        return false;

    try {
        for (const auto& entry : fs::recursive_directory_iterator(module_dir)) {
            const fs::path& current_path = entry.path();

            // Calculate relative path from module root
            fs::path rel_path = fs::relative(current_path, module_dir);
            fs::path target_path = target_base / rel_path;

            if (entry.is_regular_file() || entry.is_symlink()) {
                // Delete rule for this file
                delete_rule(target_path.string());
            } else if (entry.is_character_file()) {
                // Check for whiteout (0:0)
                struct stat st;
                if (stat(current_path.c_str(), &st) == 0 && st.st_rdev == 0) {
                    delete_rule(target_path.string());
                }
            }
        }
    } catch (const std::exception& e) {
        LOG_WARN("HymoFS rule removal error for " + module_dir.string() + ": " + e.what());
        return false;
    }
    return true;
}

std::string HymoFS::get_active_rules() {
    size_t buf_size = 16 * 1024;  // 16KB buffer
    char* raw_buf = (char*)malloc(buf_size);
    if (!raw_buf) {
        return "Error: Out of memory\n";
    }
    memset(raw_buf, 0, buf_size);

    struct hymo_syscall_list_arg arg = {.buf = raw_buf, .size = buf_size};

    LOG_INFO("HymoFS: Listing active rules...");
    int ret = hymo_execute_cmd(HYMO_CMD_LIST_RULES, &arg);
    if (ret < 0) {
        std::string err = "Error: command failed: ";
        err += strerror(errno);
        err += "\n";
        LOG_ERROR("HymoFS: get_active_rules failed: " + std::string(strerror(errno)));
        free(raw_buf);
        return err;
    }

    std::string result(raw_buf);
    LOG_INFO("HymoFS: get_active_rules returned " + std::to_string(result.length()) + " bytes");

    free(raw_buf);
    return result;
}

bool HymoFS::set_debug(bool enable) {
    int val = enable ? 1 : 0;
    LOG_INFO("HymoFS: Setting debug=" + std::string(enable ? "true" : "false"));
    bool ret = hymo_execute_cmd(HYMO_CMD_SET_DEBUG, &val) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: set_debug failed: " + std::string(strerror(errno)));
    }
    return ret;
}

bool HymoFS::set_stealth(bool enable) {
    int val = enable ? 1 : 0;
    LOG_INFO("HymoFS: Setting stealth=" + std::string(enable ? "true" : "false"));
    bool ret = hymo_execute_cmd(HYMO_CMD_SET_STEALTH, &val) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: set_stealth failed: " + std::string(strerror(errno)));
    }
    return ret;
}

bool HymoFS::set_enabled(bool enable) {
    int val = enable ? 1 : 0;
    LOG_INFO("HymoFS: Setting enabled=" + std::string(enable ? "true" : "false"));
    bool ret = hymo_execute_cmd(HYMO_CMD_SET_ENABLED, &val) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: set_enabled failed: " + std::string(strerror(errno)));
    } else {
        LOG_INFO("HymoFS: HymoFS is now " + std::string(enable ? "enabled" : "disabled"));
    }
    return ret;
}

bool HymoFS::set_uname(const std::string& release, const std::string& version) {
    // Always execute to allow clearing (sending empty strings)
    struct hymo_spoof_uname uname_data;
    memset(&uname_data, 0, sizeof(uname_data));

    if (!release.empty()) {
        strncpy(uname_data.release, release.c_str(), HYMO_UNAME_LEN - 1);
        uname_data.release[HYMO_UNAME_LEN - 1] = '\0';
    }

    if (!version.empty()) {
        strncpy(uname_data.version, version.c_str(), HYMO_UNAME_LEN - 1);
        uname_data.version[HYMO_UNAME_LEN - 1] = '\0';
    }

    LOG_INFO("HymoFS: Setting uname: release=\"" + release + "\", version=\"" + version + "\"");
    bool ret = hymo_execute_cmd(HYMO_CMD_SET_UNAME, &uname_data) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: set_uname failed: " + std::string(strerror(errno)));
    } else {
        LOG_INFO("HymoFS: set_uname success");
    }
    return ret;
}

bool HymoFS::fix_mounts() {
    LOG_INFO("HymoFS: Fixing mounts (reorder mnt_id)...");
    bool ret = hymo_execute_cmd(HYMO_CMD_REORDER_MNT_ID, nullptr) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: fix_mounts failed: " + std::string(strerror(errno)));
    } else {
        LOG_INFO("HymoFS: fix_mounts success");
    }
    return ret;
}

bool HymoFS::hide_overlay_xattrs(const std::string& path) {
    struct hymo_syscall_arg arg = {.src = path.c_str(), .target = NULL, .type = 0};

    LOG_INFO("HymoFS: Hiding overlay xattrs for path=" + path);
    bool ret = hymo_execute_cmd(HYMO_CMD_HIDE_OVERLAY_XATTRS, &arg) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: hide_overlay_xattrs failed: " + std::string(strerror(errno)));
    }
    return ret;
}

bool HymoFS::set_hook_mask(uint64_t mask) {
    char buf[32];
    snprintf(buf, sizeof(buf), "%llx", (unsigned long long)mask);
    LOG_INFO("HymoFS: Setting hook mask=0x" + std::string(buf));
    bool ret = hymo_execute_cmd(HYMO_CMD_SET_HOOK_MASK, &mask) == 0;
    if (!ret) {
        LOG_ERROR("HymoFS: set_hook_mask failed: " + std::string(strerror(errno)));
    }
    return ret;
}

}  // namespace hymo
