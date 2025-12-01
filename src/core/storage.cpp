// core/storage.cpp - Storage backend implementation
#include "storage.hpp"
#include "state.hpp"
#include "../defs.hpp"
#include "../utils.hpp"
#include <iostream>
#include <sys/mount.h>
#include <sys/vfs.h>
#include <sys/stat.h>
#include <unistd.h>

namespace hymo {

static bool try_setup_tmpfs(const fs::path& target) {
    LOG_DEBUG("Attempting Tmpfs mode...");
    
    if (!mount_tmpfs(target)) {
        LOG_WARN("Tmpfs mount failed. Falling back to Image.");
        return false;
    }
    
    if (is_xattr_supported(target)) {
        LOG_INFO("Tmpfs mode active (XATTR supported).");
        return true;
    } else {
        LOG_WARN("Tmpfs does NOT support XATTR. Unmounting...");
        umount2(target.c_str(), MNT_DETACH);
        return false;
    }
}

static std::string setup_ext4_image(const fs::path& target, const fs::path& image_path) {
    LOG_DEBUG("Falling back to Ext4 Image mode...");
    
    if (!fs::exists(image_path)) {
        throw std::runtime_error("modules.img not found at " + image_path.string());
    }
    
    if (!mount_image(image_path, target)) {
        throw std::runtime_error("Failed to mount modules.img");
    }
    
    // Repair root permissions
    LOG_DEBUG("Repairing storage root permissions...");
    
    // chmod 0755
    chmod(target.c_str(), 0755);
    
    // chown 0:0
    chown(target.c_str(), 0, 0);
    
    // Set SELinux context
    lsetfilecon(target, DEFAULT_SELINUX_CONTEXT);
    
    LOG_INFO("Image mode active and secured.");
    return "ext4";
}

StorageHandle setup_storage(const fs::path& mnt_dir, const fs::path& image_path, bool force_ext4) {
    LOG_DEBUG("Setting up storage at " + mnt_dir.string());
    
    // Clean up previous mounts
    if (fs::exists(mnt_dir)) {
        umount2(mnt_dir.c_str(), MNT_DETACH);
    }
    ensure_dir_exists(mnt_dir);
    
    std::string mode;
    if (!force_ext4 && try_setup_tmpfs(mnt_dir)) {
        mode = "tmpfs";
    } else {
        mode = setup_ext4_image(mnt_dir, image_path);
    }
    
    return StorageHandle{mnt_dir, mode};
}

static std::string format_size(uint64_t bytes) {
    const uint64_t KB = 1024;
    const uint64_t MB = KB * 1024;
    const uint64_t GB = MB * 1024;
    
    char buf[64];
    if (bytes >= GB) {
        snprintf(buf, sizeof(buf), "%.1fG", (double)bytes / GB);
    } else if (bytes >= MB) {
        snprintf(buf, sizeof(buf), "%.0fM", (double)bytes / MB);
    } else if (bytes >= KB) {
        snprintf(buf, sizeof(buf), "%.0fK", (double)bytes / KB);
    } else {
        snprintf(buf, sizeof(buf), "%luB", bytes);
    }
    return std::string(buf);
}

void print_storage_status() {
    auto state = load_runtime_state();
    
    fs::path path = state.mount_point.empty() ? 
        fs::path(FALLBACK_CONTENT_DIR) : fs::path(state.mount_point);
    
    if (!fs::exists(path)) {
        std::cout << "{ \"error\": \"Not mounted\" }\n";
        return;
    }
    
    std::string fs_type = state.storage_mode.empty() ? "unknown" : state.storage_mode;
    
    struct statfs stats;
    if (statfs(path.c_str(), &stats) != 0) {
        std::cout << "{ \"error\": \"statvfs failed\" }\n";
        return;
    }
    
    uint64_t block_size = stats.f_bsize;
    uint64_t total_bytes = stats.f_blocks * block_size;
    uint64_t free_bytes = stats.f_bfree * block_size;
    uint64_t used_bytes = total_bytes > free_bytes ? total_bytes - free_bytes : 0;
    double percent = total_bytes > 0 ? (used_bytes * 100.0 / total_bytes) : 0.0;
    
    std::cout << "{ "
              << "\"size\": \"" << format_size(total_bytes) << "\", "
              << "\"used\": \"" << format_size(used_bytes) << "\", "
              << "\"avail\": \"" << format_size(free_bytes) << "\", "
              << "\"percent\": \"" << (int)percent << "%\", "
              << "\"type\": \"" << fs_type << "\" "
              << "}\n";
}

} // namespace hymo
