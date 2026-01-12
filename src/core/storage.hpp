// core/storage.hpp - Storage management
#pragma once

#include <filesystem>
#include <string>

namespace fs = std::filesystem;

namespace hymo {

struct StorageHandle {
    fs::path mount_point;
    std::string mode;  // tmpfs, ext4, erofs
};

StorageHandle setup_storage(const fs::path& mnt_dir, const fs::path& image_path, bool force_ext4,
                            bool prefer_erofs = false);

void finalize_storage_permissions(const fs::path& storage_root);

void print_storage_status();

}  // namespace hymo