// mount/overlay.cpp - OverlayFS mounting implementation
#include "overlay.hpp"
#include "../defs.hpp"
#include "../utils.hpp"
#include <sys/mount.h>
#include <sys/syscall.h>
#include <fcntl.h>
#include <unistd.h>
#include <cstring>
#include <fstream>
#include <sstream>
#include <algorithm>

namespace hymo {

// Linux mount API syscalls
#ifndef __NR_fsopen
#define __NR_fsopen 430
#define __NR_fsconfig 431
#define __NR_fsmount 432
#define __NR_move_mount 429
#define __NR_open_tree 428
#endif

#define FSOPEN_CLOEXEC 0x00000001
#define FSCONFIG_SET_STRING 1
#define FSCONFIG_CMD_CREATE 6
#define FSMOUNT_CLOEXEC 0x00000001
#define MOVE_MOUNT_F_EMPTY_PATH 0x00000004

static int fsopen(const char* fsname, unsigned int flags) {
    return syscall(__NR_fsopen, fsname, flags);
}

static int fsconfig(int fd, unsigned int cmd, const char* key, const void* value, int aux) {
    return syscall(__NR_fsconfig, fd, cmd, key, value, aux);
}

static int fsmount(int fd, unsigned int flags, unsigned int attr_flags) {
    return syscall(__NR_fsmount, fd, flags, attr_flags);
}

static int move_mount(int from_dfd, const char* from_pathname,
                      int to_dfd, const char* to_pathname, unsigned int flags) {
    return syscall(__NR_move_mount, from_dfd, from_pathname, to_dfd, to_pathname, flags);
}

static int open_tree(int dfd, const char* filename, unsigned int flags) {
    return syscall(__NR_open_tree, dfd, filename, flags);
}

static bool mount_overlayfs_modern(
    const std::string& lowerdir_config,
    const std::optional<std::string>& upperdir,
    const std::optional<std::string>& workdir,
    const std::string& dest
) {
    int fs_fd = fsopen("overlay", FSOPEN_CLOEXEC);
    if (fs_fd < 0) {
        return false;
    }
    
    bool success = true;
    
    // Set lowerdir
    if (fsconfig(fs_fd, FSCONFIG_SET_STRING, "lowerdir", lowerdir_config.c_str(), 0) < 0) {
        success = false;
    }
    
    // Set upperdir and workdir if provided
    if (success && upperdir && workdir) {
        if (fsconfig(fs_fd, FSCONFIG_SET_STRING, "upperdir", upperdir->c_str(), 0) < 0 ||
            fsconfig(fs_fd, FSCONFIG_SET_STRING, "workdir", workdir->c_str(), 0) < 0) {
            success = false;
        }
    }
    
    // Set source
    if (success && fsconfig(fs_fd, FSCONFIG_SET_STRING, "source", KSU_OVERLAY_SOURCE, 0) < 0) {
        success = false;
    }
    
    // Create filesystem
    if (success && fsconfig(fs_fd, FSCONFIG_CMD_CREATE, nullptr, nullptr, 0) < 0) {
        success = false;
    }
    
    // Mount filesystem
    int mnt_fd = -1;
    if (success) {
        mnt_fd = fsmount(fs_fd, FSMOUNT_CLOEXEC, 0);
        if (mnt_fd < 0) {
            success = false;
        }
    }
    
    // Move mount to target
    if (success) {
        if (move_mount(mnt_fd, "", AT_FDCWD, dest.c_str(), MOVE_MOUNT_F_EMPTY_PATH) < 0) {
            success = false;
        }
    }
    
    if (mnt_fd >= 0) close(mnt_fd);
    close(fs_fd);
    
    return success;
}

static bool mount_overlayfs_legacy(
    const std::string& lowerdir_config,
    const std::optional<std::string>& upperdir,
    const std::optional<std::string>& workdir,
    const std::string& dest
) {
    std::string data = "lowerdir=" + lowerdir_config;
    if (upperdir && workdir) {
        data += ",upperdir=" + *upperdir + ",workdir=" + *workdir;
    }
    
    if (mount(KSU_OVERLAY_SOURCE, dest.c_str(), "overlay", 0, data.c_str()) != 0) {
        return false;
    }
    
    return true;
}

static std::vector<std::string> get_child_mounts(const std::string& target_root) {
    std::vector<std::string> mounts;
    
    std::ifstream mountinfo("/proc/self/mountinfo");
    if (!mountinfo.is_open()) {
        return mounts;
    }
    
    std::string line;
    while (std::getline(mountinfo, line)) {
        // Parse mountinfo line
        // Format: mount_id parent_id major:minor root mount_point ...
        std::istringstream iss(line);
        std::string mount_id, parent_id, dev, root, mount_point;
        iss >> mount_id >> parent_id >> dev >> root >> mount_point;
        
        // Check if mount_point is under target_root and not equal to it
        if (mount_point.find(target_root) == 0 && mount_point != target_root) {
            mounts.push_back(mount_point);
        }
    }
    
    // Sort and deduplicate
    std::sort(mounts.begin(), mounts.end());
    mounts.erase(std::unique(mounts.begin(), mounts.end()), mounts.end());
    
    return mounts;
}

bool bind_mount(const fs::path& from, const fs::path& to, bool disable_umount) {
    LOG_DEBUG("bind mount " + from.string() + " -> " + to.string());
    
#define OPEN_TREE_CLONE 1
#define AT_RECURSIVE 0x8000
    
    int tree_fd = open_tree(AT_FDCWD, from.c_str(), OPEN_TREE_CLONE | AT_RECURSIVE | FSOPEN_CLOEXEC);
    if (tree_fd < 0) {
        LOG_ERROR("open_tree failed: " + std::string(strerror(errno)));
        return false;
    }
    
    bool success = (move_mount(tree_fd, "", AT_FDCWD, to.c_str(), MOVE_MOUNT_F_EMPTY_PATH) == 0);
    
    close(tree_fd);
    
    if (success && !disable_umount) {
        send_unmountable(to);
    }
    
    return success;
}

static bool mount_overlay_child(
    const std::string& mount_point,
    const std::string& relative,
    const std::vector<std::string>& module_roots,
    const std::string& stock_root,
    bool disable_umount
) {
    // Check if any module modifies this child path
    bool has_modification = false;
    for (const auto& lower : module_roots) {
        fs::path path = fs::path(lower) / relative.substr(1); // Remove leading /
        if (fs::exists(path)) {
            has_modification = true;
            break;
        }
    }
    
    if (!has_modification) {
        // Just bind mount original back
        return bind_mount(stock_root, mount_point, disable_umount);
    }
    
    if (!fs::is_directory(stock_root)) {
        return true;
    }
    
    // Collect lowerdirs for this child
    std::vector<std::string> lower_dirs;
    for (const auto& lower : module_roots) {
        fs::path path = fs::path(lower) / relative.substr(1);
        if (fs::is_directory(path)) {
            lower_dirs.push_back(path.string());
        } else if (fs::exists(path)) {
            // File covering directory - invalid for overlayfs
            return true;
        }
    }
    
    if (lower_dirs.empty()) {
        return true;
    }
    
    // Build lowerdir string
    std::string lowerdir_config;
    for (size_t i = 0; i < lower_dirs.size(); ++i) {
        lowerdir_config += lower_dirs[i];
        if (i < lower_dirs.size() - 1) {
            lowerdir_config += ":";
        }
    }
    lowerdir_config += ":" + stock_root;
    
    // Try modern API first
    if (!mount_overlayfs_modern(lowerdir_config, std::nullopt, std::nullopt, mount_point)) {
        // Fallback to legacy
        if (!mount_overlayfs_legacy(lowerdir_config, std::nullopt, std::nullopt, mount_point)) {
            LOG_WARN("failed to overlay child " + mount_point + ", fallback to bind mount");
            return bind_mount(stock_root, mount_point, disable_umount);
        }
    }
    
    if (!disable_umount) {
        send_unmountable(mount_point);
    }
    
    return true;
}

bool mount_overlay(
    const std::string& target_root,
    const std::vector<std::string>& module_roots,
    std::optional<fs::path> upperdir,
    std::optional<fs::path> workdir,
    bool disable_umount
) {
    LOG_INFO("Starting robust overlay mount for " + target_root);
    
    // 1. chdir to target to hold reference
    if (chdir(target_root.c_str()) != 0) {
        LOG_ERROR("failed to chdir to " + target_root + ": " + strerror(errno));
        return false;
    }
    
    std::string stock_root = ".";
    
    // 2. Scan for child mounts BEFORE overlaying
    auto mount_seq = get_child_mounts(target_root);
    
    // 3. Build lowerdir configuration
    std::string lowerdir_config;
    for (size_t i = 0; i < module_roots.size(); ++i) {
        lowerdir_config += module_roots[i];
        if (i < module_roots.size() - 1) {
            lowerdir_config += ":";
        }
    }
    lowerdir_config += ":" + target_root;
    
    LOG_DEBUG("lowerdir=" + lowerdir_config);
    
    std::optional<std::string> upperdir_str;
    std::optional<std::string> workdir_str;
    
    if (upperdir && fs::exists(*upperdir)) {
        upperdir_str = upperdir->string();
    }
    if (workdir && fs::exists(*workdir)) {
        workdir_str = workdir->string();
    }
    
    // 3. Mount root overlay
    bool success = mount_overlayfs_modern(lowerdir_config, upperdir_str, workdir_str, target_root);
    if (!success) {
        LOG_WARN("fsopen mount failed, fallback to legacy mount");
        success = mount_overlayfs_legacy(lowerdir_config, upperdir_str, workdir_str, target_root);
    }
    
    if (!success) {
        LOG_ERROR("mount overlayfs for root " + target_root + " failed: " + strerror(errno));
        return false;
    }
    
    if (!disable_umount) {
        send_unmountable(target_root);
    }
    
    // 4. Restore child mounts
    for (const auto& mount_point : mount_seq) {
        // Calculate relative path
        std::string relative = mount_point;
        if (mount_point.find(target_root) == 0) {
            relative = mount_point.substr(target_root.length());
        }
        
        std::string stock_root_relative = stock_root + relative;
        
        if (!fs::exists(stock_root_relative)) {
            continue;
        }
        
        if (!mount_overlay_child(mount_point, relative, module_roots, stock_root_relative, disable_umount)) {
            LOG_WARN("failed to restore child mount " + mount_point);
        }
    }
    
    return true;
}

} // namespace hymo
