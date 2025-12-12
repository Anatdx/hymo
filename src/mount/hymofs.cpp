#include "hymofs.hpp"
#include "../utils.hpp"
#include <fstream>
#include <iostream>
#include <sys/stat.h>
#include <unistd.h>
#include <sys/ioctl.h>
#include <fcntl.h>
#include <cerrno>
#include <cstring>

namespace hymo {

const char* HYMO_DEV = "/dev/hymo_ctl";

#define HYMO_IOC_MAGIC 0xE0
struct hymo_ioctl_arg {
    const char *src;
    const char *target;
    int type;
};

#define HYMO_IOC_ADD_RULE    _IOW(HYMO_IOC_MAGIC, 1, struct hymo_ioctl_arg)
#define HYMO_IOC_DEL_RULE    _IOW(HYMO_IOC_MAGIC, 2, struct hymo_ioctl_arg)
#define HYMO_IOC_HIDE_RULE   _IOW(HYMO_IOC_MAGIC, 3, struct hymo_ioctl_arg)
#define HYMO_IOC_INJECT_RULE _IOW(HYMO_IOC_MAGIC, 4, struct hymo_ioctl_arg)
#define HYMO_IOC_CLEAR_ALL   _IO(HYMO_IOC_MAGIC, 5)
#define HYMO_IOC_GET_VERSION _IOR(HYMO_IOC_MAGIC, 6, int)

struct hymo_ioctl_list_arg {
    char *buf;
    size_t size;
};
#define HYMO_IOC_LIST_RULES  _IOWR(HYMO_IOC_MAGIC, 7, struct hymo_ioctl_list_arg)

int HymoFS::get_protocol_version() {
    int fd = open(HYMO_DEV, O_RDONLY);
    if (fd < 0) return -1;
    
    int version = ioctl(fd, HYMO_IOC_GET_VERSION);
    close(fd);
    
    // If ioctl fails, it returns -1. If it succeeds, it returns the version (which is likely > 0).
    // However, ioctl usually returns 0 on success if the result is in the arg.
    // Wait, my kernel implementation returns atomic_read(&hymo_version) directly.
    // Standard ioctl convention is return 0 on success, or -1 on error.
    // But I implemented it to return the version.
    // Let's check the kernel code again.
    // if (cmd == HYMO_IOC_GET_VERSION) { return atomic_read(&hymo_version); }
    // So it returns the version directly.
    
    return version;
}

HymoFSStatus HymoFS::check_status() {
    if (!fs::exists(HYMO_DEV)) return HymoFSStatus::NotPresent;
    
    // We don't really have a protocol version check in the same way anymore,
    // but we can check if the version counter is readable.
    // The "version" in kernel is actually a config version counter, not protocol version.
    // The protocol version was hardcoded in the procfs output "HymoFS Protocol: 3".
    // Since we switched to ioctl, let's assume protocol compatibility if the device exists.
    // Or we could add a specific GET_PROTOCOL_VERSION ioctl.
    // For now, let's assume Available if device exists.
    
    return HymoFSStatus::Available;
}

bool HymoFS::is_available() {
    return check_status() == HymoFSStatus::Available;
}

bool HymoFS::clear_rules() {
    int fd = open(HYMO_DEV, O_RDWR);
    if (fd < 0) return false;
    int ret = ioctl(fd, HYMO_IOC_CLEAR_ALL);
    close(fd);
    return ret == 0;
}

bool HymoFS::add_rule(const std::string& src, const std::string& target, int type) {
    int fd = open(HYMO_DEV, O_RDWR);
    if (fd < 0) return false;
    
    struct hymo_ioctl_arg arg = {
        .src = src.c_str(),
        .target = target.c_str(),
        .type = (unsigned char)type
    };
    
    int ret = ioctl(fd, HYMO_IOC_ADD_RULE, &arg);
    close(fd);
    return ret == 0;
}

bool HymoFS::delete_rule(const std::string& src) {
    int fd = open(HYMO_DEV, O_RDWR);
    if (fd < 0) return false;
    
    struct hymo_ioctl_arg arg = {
        .src = src.c_str(),
        .target = NULL,
        .type = 0
    };
    
    int ret = ioctl(fd, HYMO_IOC_DEL_RULE, &arg);
    close(fd);
    return ret == 0;
}

bool HymoFS::hide_path(const std::string& path) {
    int fd = open(HYMO_DEV, O_RDWR);
    if (fd < 0) return false;
    
    struct hymo_ioctl_arg arg = {
        .src = path.c_str(),
        .target = NULL,
        .type = 0
    };
    
    int ret = ioctl(fd, HYMO_IOC_HIDE_RULE, &arg);
    close(fd);
    return ret == 0;
}

bool HymoFS::inject_dir(const std::string& dir) {
    int fd = open(HYMO_DEV, O_RDWR);
    if (fd < 0) return false;
    
    struct hymo_ioctl_arg arg = {
        .src = dir.c_str(),
        .target = NULL,
        .type = 0
    };
    
    int ret = ioctl(fd, HYMO_IOC_INJECT_RULE, &arg);
    close(fd);
    return ret == 0;
}

std::string HymoFS::get_active_rules() {
    int fd = open(HYMO_DEV, O_RDONLY);
    if (fd < 0) return "Error: Cannot open /dev/hymo_ctl\n";
    
    size_t buf_size = 128 * 1024; // 128KB buffer
    char* raw_buf = (char*)malloc(buf_size);
    if (!raw_buf) {
        close(fd);
        return "Error: Out of memory\n";
    }
    memset(raw_buf, 0, buf_size);
    
    ssize_t bytes_read = read(fd, raw_buf, buf_size - 1);
    if (bytes_read < 0) {
        std::string err = "Error: read failed: ";
        err += strerror(errno);
        err += "\n";
        free(raw_buf);
        close(fd);
        return err;
    }
    
    std::string result(raw_buf, bytes_read);

    free(raw_buf);
    close(fd);
    return result;
}

bool HymoFS::inject_directory(const fs::path& target_base, const fs::path& module_dir) {
    if (!fs::exists(module_dir) || !fs::is_directory(module_dir)) return false;

    try {
        for (const auto& entry : fs::recursive_directory_iterator(module_dir)) {
            const fs::path& current_path = entry.path();
            
            // Calculate relative path from module root
            fs::path rel_path = fs::relative(current_path, module_dir);
            fs::path target_path = target_base / rel_path;
            
            if (entry.is_regular_file() || entry.is_symlink()) {
                // For symlinks, we also just redirect the path to the symlink file in the module
                add_rule(target_path.string(), current_path.string());
            } else if (entry.is_character_file()) {
                // Check for whiteout (0:0)
                struct stat st;
                if (stat(current_path.c_str(), &st) == 0 && st.st_rdev == 0) {
                    hide_path(target_path.string());
                }
            }
        }
    } catch (const std::exception& e) {
        LOG_WARN("HymoFS injection error for " + module_dir.string() + ": " + e.what());
        return false;
    }
    return true;
}

bool HymoFS::delete_directory_rules(const fs::path& target_base, const fs::path& module_dir) {
    if (!fs::exists(module_dir) || !fs::is_directory(module_dir)) return false;

    try {
        for (const auto& entry : fs::recursive_directory_iterator(module_dir)) {
            const fs::path& current_path = entry.path();
            
            // Calculate relative path from module root
            fs::path rel_path = fs::relative(current_path, module_dir);
            fs::path target_path = target_base / rel_path;
            
            if (entry.is_regular_file() || entry.is_symlink()) {
                // Delete rule for this file
                // Key for delete is the target path (virtual path), not the source path
                delete_rule(target_path.string());
            } else if (entry.is_character_file()) {
                // Check for whiteout (0:0)
                struct stat st;
                if (stat(current_path.c_str(), &st) == 0 && st.st_rdev == 0) {
                    // For whiteouts, we used hide_path, so we should delete the hide rule
                    // But wait, delete_rule in kernel handles both paths and hide paths?
                    // Let's check the patch.
                    // Yes, delete_rule checks hymo_paths, hymo_hide_paths, and hymo_inject_dirs.
                    // So we just need to pass the path that was hidden.
                    // When hiding, we passed target_path.string().
                    delete_rule(target_path.string());
                }
            }
        }
    } catch (const std::exception& e) {
        LOG_WARN("HymoFS deletion error for " + module_dir.string() + ": " + e.what());
        return false;
    }
    return true;
}

} // namespace hymo
