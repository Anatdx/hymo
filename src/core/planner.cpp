// core/planner.cpp - Mount planning implementation
#include "planner.hpp"
#include "../defs.hpp"
#include "../utils.hpp"
#include <map>
#include <set>
#include <algorithm>

namespace hymo {

static bool has_files(const fs::path& path) {
    if (!fs::exists(path) || !fs::is_directory(path)) {
        return false;
    }
    
    try {
        for (const auto& entry : fs::directory_iterator(path)) {
            (void)entry; // Suppress unused warning
            return true;
        }
    } catch (...) {
        return false;
    }
    
    return false;
}

static bool has_meaningful_content(const fs::path& base, const std::vector<std::string>& partitions) {
    for (const auto& part : partitions) {
        fs::path p = base / part;
        if (fs::exists(p) && has_files(p)) {
            return true;
        }
    }
    return false;
}

MountPlan generate_plan(
    const Config& config,
    const std::vector<Module>& modules,
    const fs::path& storage_root
) {
    MountPlan plan;
    
    std::map<std::string, std::vector<fs::path>> partition_layers;
    std::set<fs::path> magic_paths;
    std::set<std::string> overlay_ids;
    std::set<std::string> magic_ids;
    
    // Build list of target partitions
    std::vector<std::string> target_partitions = BUILTIN_PARTITIONS;
    for (const auto& part : config.partitions) {
        target_partitions.push_back(part);
    }
    
    // Process modules (already sorted Z->A from inventory)
    for (const auto& module : modules) {
        fs::path content_path = storage_root / module.id;
        
        if (!fs::exists(content_path)) {
            LOG_DEBUG("Planner: Module " + module.id + " content missing, skipping");
            continue;
        }
        
        // Check if module has any meaningful content (including extra partitions)
        if (!has_meaningful_content(content_path, target_partitions)) {
            LOG_DEBUG("Planner: Module " + module.id + " content missing, skipping");
            continue;
        }
        
        if (module.mode == "magic") {
            // Force Magic Mount
            magic_paths.insert(content_path);
            magic_ids.insert(module.id);
        } else {
            // Try OverlayFS ("auto" mode)
            bool participates_in_overlay = false;
            
            for (const auto& part : target_partitions) {
                fs::path part_path = content_path / part;
                
                // Skip if partition directory doesn't exist or is empty
                if (fs::is_directory(part_path) && has_files(part_path)) {
                    partition_layers[part].push_back(part_path);
                    participates_in_overlay = true;
                }
            }
            
            if (participates_in_overlay) {
                overlay_ids.insert(module.id);
            }
        }
    }
    
    // Construct Overlay Operations
    for (auto& [part, layers] : partition_layers) {
        std::string initial_target = "/" + part;
        fs::path target_path(initial_target);
        
        // Resolve symlinks
        fs::path resolved_target;
        try {
            if (fs::is_symlink(target_path) || fs::exists(target_path)) {
                resolved_target = fs::canonical(target_path);
                if (resolved_target != target_path) {
                    LOG_DEBUG("Planner: Resolved symlink " + initial_target + " -> " + resolved_target.string());
                }
            } else {
                // Path doesn't exist, cannot mount
                continue;
            }
        } catch (const std::exception& e) {
            LOG_WARN("Planner: Failed to resolve path " + initial_target + ": " + e.what() + ". Skipping.");
            continue;
        }
        
        // Verify target is a directory
        if (!fs::is_directory(resolved_target)) {
            LOG_WARN("Planner: Target " + resolved_target.string() + " is not a directory, skipping");
            continue;
        }
        
        plan.overlay_ops.push_back(OverlayOperation{resolved_target.string(), layers});
    }
    
    // Copy sets to vectors
    plan.magic_module_paths.assign(magic_paths.begin(), magic_paths.end());
    plan.overlay_module_ids.assign(overlay_ids.begin(), overlay_ids.end());
    plan.magic_module_ids.assign(magic_ids.begin(), magic_ids.end());
    
    // Sort IDs for consistent reporting
    std::sort(plan.overlay_module_ids.begin(), plan.overlay_module_ids.end());
    std::sort(plan.magic_module_ids.begin(), plan.magic_module_ids.end());
    
    return plan;
}

} // namespace hymo
