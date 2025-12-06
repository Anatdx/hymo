// core/sync.cpp - Module content synchronization implementation (FIXED)
#include "sync.hpp"
#include "../utils.hpp"
#include "../defs.hpp"
#include <set>
#include <fstream>

namespace hymo {

// Helper: 递归检查目录是否有文件
static bool has_files_recursive(const fs::path& path) {
    if (!fs::exists(path) || !fs::is_directory(path)) {
        return false;
    }
    
    try {
        for (const auto& entry : fs::recursive_directory_iterator(path)) {
            if (fs::is_regular_file(entry) || fs::is_symlink(entry)) {
                return true;
            }
        }
    } catch (...) {
        return true; // 无法读取时假定有内容
    }
    
    return false;
}

// Helper: 检查模块是否对任何分区有内容(内置或额外)
static bool has_content(const fs::path& module_path, const std::vector<std::string>& all_partitions) {
    for (const auto& partition : all_partitions) {
        fs::path part_path = module_path / partition;
        if (has_files_recursive(part_path)) {
            return true;
        }
    }
    return false;
}

// Helper: 通过比较 module.prop 检查模块是否需要同步
static bool should_sync(const fs::path& src, const fs::path& dst) {
    if (!fs::exists(dst)) {
        return true; // 新模块
    }
    
    fs::path src_prop = src / "module.prop";
    fs::path dst_prop = dst / "module.prop";
    
    if (!fs::exists(src_prop) || !fs::exists(dst_prop)) {
        return true; // 缺少 prop 文件,强制同步
    }
    
    // 比较文件内容
    try {
        std::ifstream src_file(src_prop, std::ios::binary);
        std::ifstream dst_file(dst_prop, std::ios::binary);
        
        std::string src_content((std::istreambuf_iterator<char>(src_file)),
                                std::istreambuf_iterator<char>());
        std::string dst_content((std::istreambuf_iterator<char>(dst_file)),
                                std::istreambuf_iterator<char>());
        
        return src_content != dst_content;
    } catch (...) {
        return true; // 读取错误,强制同步
    }
}

// Helper: 移除孤立的模块目录
static void prune_orphaned_modules(const std::vector<Module>& modules, const fs::path& storage_root) {
    if (!fs::exists(storage_root)) {
        return;
    }
    
    // 构建活动模块 ID 集合
    std::set<std::string> active_ids;
    for (const auto& module : modules) {
        active_ids.insert(module.id);
    }
    
    try {
        for (const auto& entry : fs::directory_iterator(storage_root)) {
            std::string name = entry.path().filename().string();
            
            // 跳过内部目录
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

// **FIX 1: 改进 SELinux Context 修复逻辑**
static void recursive_context_repair(const fs::path& base, const fs::path& current) {
    if (!fs::exists(current)) {
        return;
    }
    
    try {
        std::string file_name = current.filename().string();
        
        // **关键修复: 对 upperdir/workdir 使用父目录的 context**
        if (file_name == "upperdir" || file_name == "workdir") {
            if (current.has_parent_path()) {
                fs::path parent = current.parent_path();
                try {
                    std::string parent_ctx = lgetfilecon(parent);
                    lsetfilecon(current, parent_ctx);
                } catch (...) {
                    // Ignore errors to match Rust behavior
                }
            }
        } else {
            // 对于正常文件/目录,尝试从系统路径获取 context
            fs::path relative = fs::relative(current, base);
            fs::path system_path = fs::path("/") / relative;
            
            if (fs::exists(system_path)) {
                copy_path_context(system_path, current);
            }
        }
        
        // **递归处理子目录**
        if (fs::is_directory(current)) {
            for (const auto& entry : fs::directory_iterator(current)) {
                recursive_context_repair(base, entry.path());
            }
        }
    } catch (const std::exception& e) {
        LOG_DEBUG("Context repair failed for " + current.string() + ": " + e.what());
    }
}

// **FIX 2: 修复模块 SELinux Context**
static void repair_module_contexts(const fs::path& module_root, const std::string& module_id, const std::vector<std::string>& all_partitions) {
    LOG_DEBUG("Repairing SELinux contexts for module: " + module_id);
    
    for (const auto& partition : all_partitions) {
        fs::path part_root = module_root / partition;
        
        if (fs::exists(part_root) && fs::is_directory(part_root)) {
            try {
                recursive_context_repair(module_root, part_root);
            } catch (const std::exception& e) {
                LOG_WARN("Context repair failed for " + module_id + "/" + partition + ": " + e.what());
            }
        }
    }
}

void perform_sync(const std::vector<Module>& modules, const fs::path& storage_root, const Config& config) {
    LOG_INFO("Starting smart module sync to " + storage_root.string());
    
    // 构建完整的分区列表(内置 + 额外)
    std::vector<std::string> all_partitions = BUILTIN_PARTITIONS;
    for (const auto& part : config.partitions) {
        all_partitions.push_back(part);
    }
    
    // 1. 清理孤立目录(清理已禁用/移除的模块)
    prune_orphaned_modules(modules, storage_root);
    
    // 2. 同步每个模块
    for (const auto& module : modules) {
        fs::path dst = storage_root / module.id;
        
        // 检查模块是否对任何分区有实际内容(包括额外分区)
        if (!has_content(module.source_path, all_partitions)) {
            LOG_DEBUG("Skipping empty module: " + module.id);
            continue;
        }
        
        if (should_sync(module.source_path, dst)) {
            LOG_DEBUG("Syncing module: " + module.id + " (Updated/New)");
            
            // 同步前清理目标目录
            if (fs::exists(dst)) {
                try {
                    fs::remove_all(dst);
                } catch (const std::exception& e) {
                    LOG_WARN("Failed to clean target dir for " + module.id);
                }
            }
            
            if (!sync_dir(module.source_path, dst)) {
                LOG_ERROR("Failed to sync module " + module.id);
            } else {
                // **FIX 3: 同步成功后立即修复 SELinux Context**
                repair_module_contexts(dst, module.id, all_partitions);
            }
        } else {
            LOG_DEBUG("Skipping module: " + module.id + " (Up-to-date)");
        }
    }
    
    LOG_INFO("Module sync completed.");
}

} // namespace hymo