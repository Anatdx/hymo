// core/planner.cpp - Mount planning implementation
#include "planner.hpp"
#include "../defs.hpp"
#include "../utils.hpp"
#include "../mount/hymofs.hpp"
#include <map>
#include <set>
#include <algorithm>
#include <sys/stat.h>
#include <sys/sysmacros.h>
#include <dirent.h>

namespace hymo {

bool MountPlan::is_covered_by_overlay(const std::string& path) const {
    for (const auto& op : overlay_ops) {
        std::string p_str = path;
        std::string t_str = op.target;
        
        if (p_str == t_str) return true;
        
        if (p_str.size() > t_str.size() && 
            p_str.compare(0, t_str.size(), t_str) == 0 && 
            p_str[t_str.size()] == '/') {
            return true;
        }
    }
    return false;
}

static bool has_files(const fs::path& path) {
    if (!fs::exists(path) || !fs::is_directory(path)) {
        return false;
    }
    try {
        for (const auto& entry : fs::directory_iterator(path)) {
            (void)entry;
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
    
    std::map<std::string, std::vector<fs::path>> overlay_layers;
    std::set<fs::path> magic_paths;
    std::set<std::string> overlay_ids;
    std::set<std::string> magic_ids;
    
    std::vector<std::string> target_partitions = BUILTIN_PARTITIONS;
    for (const auto& part : config.partitions) {
        target_partitions.push_back(part);
    }
    
    bool use_hymofs = HymoFS::is_available();
    
    for (const auto& module : modules) {
        fs::path content_path = storage_root / module.id;
        
        if (!fs::exists(content_path)) continue;
        if (!has_meaningful_content(content_path, target_partitions)) continue;
        
        if (module.mode == "magic") {
            magic_paths.insert(content_path);
            magic_ids.insert(module.id);
            continue;
        }
        
        // If HymoFS is available, we use it for everything except magic modules.
        if (use_hymofs) {
            plan.hymofs_module_ids.push_back(module.id);
        } else {
            // Fallback to OverlayFS
            bool participates_in_overlay = false;
            for (const auto& part : target_partitions) {
                fs::path part_path = content_path / part;
                if (fs::is_directory(part_path) && has_files(part_path)) {
                    std::string part_root = "/" + part;
                    overlay_layers[part_root].push_back(part_path);
                    participates_in_overlay = true;
                }
            }
            if (participates_in_overlay) {
                overlay_ids.insert(module.id);
            }
        }
    }
    
    // Construct Overlay Operations (only if not using HymoFS)
    for (auto& [target, layers] : overlay_layers) {
        if (layers.empty()) continue;
        
        // Resolve symlinks for target
        fs::path target_path(target);
        if (fs::is_symlink(target_path)) {
             try {
                 target_path = fs::read_symlink(target_path);
                 if (target_path.is_relative()) {
                     target_path = fs::path(target).parent_path() / target_path;
                 }
                 target_path = fs::canonical(target_path);
             } catch (...) {}
        }
        
        if (!fs::exists(target_path) || !fs::is_directory(target_path)) {
             continue;
        }
        
        plan.overlay_ops.push_back(OverlayOperation{target_path.string(), layers});
    }
    
    plan.magic_module_paths.assign(magic_paths.begin(), magic_paths.end());
    plan.overlay_module_ids.assign(overlay_ids.begin(), overlay_ids.end());
    plan.magic_module_ids.assign(magic_ids.begin(), magic_ids.end());
    
    return plan;
}

void update_hymofs_mappings(
    const Config& config,
    const std::vector<Module>& modules,
    const fs::path& storage_root,
    const MountPlan& plan
) {
    if (!HymoFS::is_available()) return;

    // Clear existing mappings
    HymoFS::clear_rules();

    std::vector<std::string> target_partitions = BUILTIN_PARTITIONS;
    for (const auto& part : config.partitions) {
        target_partitions.push_back(part);
    }

    std::set<std::string> injected_dirs;
    struct AddRule {
        std::string src;
        std::string target;
        int type;
    };
    std::vector<AddRule> add_rules;
    std::vector<std::string> hide_rules;

    // Iterate in reverse (Lowest Priority -> Highest Priority)
    // Assuming "Last Write Wins" in kernel module
    for (auto it = modules.rbegin(); it != modules.rend(); ++it) {
        const auto& module = *it;
        
        bool is_hymofs = false;
        for(const auto& id : plan.hymofs_module_ids) {
            if(id == module.id) { is_hymofs = true; break; }
        }
        if (!is_hymofs) continue;

        fs::path mod_path = storage_root / module.id;
        
        for (const auto& part : target_partitions) {
            fs::path part_root = mod_path / part;
            if (!fs::exists(part_root)) continue;

            try {
                for (const auto& entry : fs::recursive_directory_iterator(part_root)) {
                    fs::path rel = fs::relative(entry.path(), mod_path);
                    fs::path virtual_path = fs::path("/") / rel;
                    
                    if (plan.is_covered_by_overlay(virtual_path.string())) {
                        continue;
                    }
                    
                    if (entry.is_regular_file() || entry.is_symlink()) {
                        // Safety Check: Do not replace existing directories with symlinks
                        // This prevents modules from accidentally hiding /system_ext, /vendor, etc.
                        if (entry.is_symlink()) {
                            if (fs::exists(virtual_path) && fs::is_directory(virtual_path)) {
                                LOG_WARN("Safety: Skipping symlink replacement for directory: " + virtual_path.string());
                                continue;
                            }
                        }
                        int type = DT_UNKNOWN;
                        if (entry.is_regular_file()) type = DT_REG;
                        else if (entry.is_symlink()) type = DT_LNK;
                        else if (entry.is_directory()) type = DT_DIR;
                        else if (entry.is_block_file()) type = DT_BLK;
                        else if (entry.is_character_file()) type = DT_CHR;
                        else if (entry.is_fifo()) type = DT_FIFO;
                        else if (entry.is_socket()) type = DT_SOCK;

                        add_rules.push_back({virtual_path.string(), entry.path().string(), type});
                        injected_dirs.insert(virtual_path.parent_path().string());
                    } else if (entry.is_character_file()) {
                        // Check for whiteout (0:0)
                        struct stat st;
                        if (stat(entry.path().c_str(), &st) == 0) {
                            if (major(st.st_rdev) == 0 && minor(st.st_rdev) == 0) {
                                hide_rules.push_back(virtual_path.string());
                            }
                        }
                    }
                }
            } catch (const std::exception& e) {
                LOG_WARN("Error scanning module " + module.id + ": " + std::string(e.what()));
            }
        }
    }
    
    // Apply rules: Inject dirs first, then add files, then hide
    for (const auto& dir : injected_dirs) {
        HymoFS::inject_dir(dir);
    }
    for (const auto& rule : add_rules) {
        HymoFS::add_rule(rule.src, rule.target, rule.type);
    }
    for (const auto& path : hide_rules) {
        HymoFS::hide_path(path);
    }
    
    LOG_INFO("HymoFS mappings updated.");
}

} // namespace hymo
