// core/sync.cpp - Module content synchronization implementation
#include "sync.hpp"
#include "../utils.hpp"
#include "../defs.hpp"
#include <set>
#include <fstream>

namespace hymo {

// Helper: Recursively check if a directory has any files
static bool has_files_recursive(const fs::path& path) {
    if (!fs::exists(path) || !fs::is_directory(path)) {
        return false;
    }
    
    try {
        for (const auto& entry : fs::recursive_directory_iterator(path)) {
            if (fs::is_regular_file(entry) || fs::is_symlink(entry)) {
                return true; // Found actual content
            }
        }
    } catch (...) {
        // If we can't read it, assume it has content
        return true;
    }
    
    return false;
}

// Helper: Check if module has content for any partition (builtin or extra)
static bool has_content(const fs::path& module_path, const std::vector<std::string>& all_partitions) {
    for (const auto& partition : all_partitions) {
        fs::path part_path = module_path / partition;
        if (has_files_recursive(part_path)) {
            return true;
        }
    }
    return false;
}

// Helper: Check if module needs sync by comparing module.prop
static bool should_sync(const fs::path& src, const fs::path& dst) {
    if (!fs::exists(dst)) {
        return true; // New module
    }
    
    fs::path src_prop = src / "module.prop";
    fs::path dst_prop = dst / "module.prop";
    
    if (!fs::exists(src_prop) || !fs::exists(dst_prop)) {
        return true; // Missing prop file, force sync
    }
    
    // Compare file contents
    try {
        std::ifstream src_file(src_prop, std::ios::binary);
        std::ifstream dst_file(dst_prop, std::ios::binary);
        
        std::string src_content((std::istreambuf_iterator<char>(src_file)),
                                std::istreambuf_iterator<char>());
        std::string dst_content((std::istreambuf_iterator<char>(dst_file)),
                                std::istreambuf_iterator<char>());
        
        return src_content != dst_content;
    } catch (...) {
        return true; // Error reading, force sync
    }
}

// Helper: Remove orphaned module directories
static void prune_orphaned_modules(const std::vector<Module>& modules, const fs::path& storage_root) {
    if (!fs::exists(storage_root)) {
        return;
    }
    
    // Build set of active module IDs
    std::set<std::string> active_ids;
    for (const auto& module : modules) {
        active_ids.insert(module.id);
    }
    
    try {
        for (const auto& entry : fs::directory_iterator(storage_root)) {
            std::string name = entry.path().filename().string();
            
            // Skip internal directories
            if (name == "lost+found" || name == "hymo") {
                continue;
            }
            
            if (active_ids.find(name) == active_ids.end()) {
                LOG_INFO("Pruning orphaned module storage: " + name);
                try {
                    fs::remove_all(entry.path());
                } catch (const std::exception& e) {
                    LOG_WARN("Failed to remove orphan: " + name);
                }
            }
        }
    } catch (...) {
        LOG_WARN("Failed to prune orphaned modules");
    }
}

void perform_sync(const std::vector<Module>& modules, const fs::path& storage_root, const Config& config) {
    LOG_INFO("Starting smart module sync to " + storage_root.string());
    
    // Build complete partition list (builtin + extra)
    std::vector<std::string> all_partitions = BUILTIN_PARTITIONS;
    for (const auto& part : config.partitions) {
        all_partitions.push_back(part);
    }
    
    // 1. Prune orphaned directories (cleanup disabled/removed modules)
    prune_orphaned_modules(modules, storage_root);
    
    // 2. Sync each module
    for (const auto& module : modules) {
        fs::path dst = storage_root / module.id;
        
        // Check if module has actual content for any partition (including extra)
        if (!has_content(module.source_path, all_partitions)) {
            LOG_DEBUG("Skipping empty module: " + module.id);
            continue;
        }
        
        if (should_sync(module.source_path, dst)) {
            LOG_DEBUG("Syncing module: " + module.id + " (Updated/New)");
            
            // Clean target directory before copying
            if (fs::exists(dst)) {
                try {
                    fs::remove_all(dst);
                } catch (const std::exception& e) {
                    LOG_WARN("Failed to clean target dir for " + module.id);
                }
            }
            
            if (!sync_dir(module.source_path, dst)) {
                LOG_ERROR("Failed to sync module " + module.id);
            }
        } else {
            LOG_DEBUG("Skipping module: " + module.id + " (Up-to-date)");
        }
    }
    
    LOG_INFO("Module sync completed.");
}

} // namespace hymo
