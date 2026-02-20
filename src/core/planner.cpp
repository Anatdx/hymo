// core/planner.cpp - Mount planning implementation (HymoFS-only minimal)
#include "planner.hpp"
#include <dirent.h>
#include <sys/stat.h>
#include <sys/sysmacros.h>
#include <algorithm>
#include <map>
#include <set>
#include "../defs.hpp"
#include "../mount/hymofs.hpp"
#include "../utils.hpp"
#include "user_rules.hpp"

namespace hymo {

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

static bool has_meaningful_content(const fs::path& base,
                                   const std::vector<std::string>& partitions) {
    for (const auto& part : partitions) {
        fs::path p = base / part;
        if (fs::exists(p) && has_files(p)) {
            return true;
        }
    }
    return false;
}

// Helper: Resolve symlinks in directory symlinks but preserve filename logic
static std::string resolve_path_for_hymofs(const std::string& path_str) {
    try {
        fs::path p(path_str);
        if (!p.has_parent_path())
            return path_str;

        fs::path parent = p.parent_path();
        fs::path filename = p.filename();

        fs::path curr = parent;
        std::vector<fs::path> suffix;

        // Walk up until we find an existing path
        while (!curr.empty() && curr != "/" && !fs::exists(curr)) {
            suffix.push_back(curr.filename());
            curr = curr.parent_path();
        }

        // Resolve the existing base
        if (fs::exists(curr)) {
            curr = fs::canonical(curr);
        }

        // Re-append the non-existing suffix
        for (auto it = suffix.rbegin(); it != suffix.rend(); ++it) {
            curr /= *it;
        }

        curr /= filename;
        return curr.string();
    } catch (...) {
        return path_str;
    }
}

MountPlan generate_plan(const HymoParams& params, const std::vector<Module>& modules) {
    MountPlan plan;

    std::vector<std::string> target_partitions = BUILTIN_PARTITIONS;
    for (const auto& part : params.partitions)
        target_partitions.push_back(part);

    HymoFSStatus status = HymoFS::check_status();
    bool use_hymofs = (status == HymoFSStatus::Available) ||
                      (params.ignore_protocol_mismatch &&
                       (status == HymoFSStatus::KernelTooOld || status == HymoFSStatus::ModuleTooOld));

    if (!use_hymofs)
        return plan;

    for (const auto& module : modules) {
        fs::path content_path = params.storage_root / module.id;

        if (!fs::exists(content_path))
            continue;
        if (!has_meaningful_content(content_path, target_partitions))
            continue;

        // Determine default mode (minimal: only hymofs/none/auto)
        std::string default_mode = module.mode;
        if (default_mode == "auto" || default_mode == "overlay" || default_mode == "magic")
            default_mode = "hymofs";

        bool has_rules = !module.rules.empty();

        if (!has_rules) {
            if (default_mode == "none")
                continue;
            plan.hymofs_module_ids.push_back(module.id);
            continue;
        }

        // Mixed mode: check if any rule uses hymofs
        bool hymofs_active = false;
        for (const auto& part : target_partitions) {
            fs::path part_root = content_path / part;
            if (!fs::exists(part_root))
                continue;

            for (const auto& entry : fs::recursive_directory_iterator(part_root)) {
                fs::path rel = fs::relative(entry.path(), content_path);
                std::string path_str = "/" + rel.string();

                std::string mode = default_mode;
                size_t max_len = 0;
                for (const auto& rule : module.rules) {
                    if (path_str == rule.path ||
                        (path_str.size() > rule.path.size() &&
                         path_str.compare(0, rule.path.size(), rule.path) == 0 &&
                         path_str[rule.path.size()] == '/')) {
                        if (rule.path.size() > max_len) {
                            max_len = rule.path.size();
                            mode = rule.mode;
                        }
                    }
                }

                if (mode == "none")
                    continue;
                if (mode == "hymofs" || mode == "auto") {
                    hymofs_active = true;
                    break;
                }
            }
            if (hymofs_active)
                break;
        }

        if (hymofs_active)
            plan.hymofs_module_ids.push_back(module.id);
    }

    return plan;
}

struct AddRule {
    std::string src;
    std::string target;
    int type;
};

void update_hymofs_mappings(const HymoParams& params, const std::vector<Module>& modules,
                            MountPlan& plan) {
    if (!HymoFS::is_available())
        return;

    HymoFS::clear_rules();

    std::vector<std::string> target_partitions = BUILTIN_PARTITIONS;
    for (const auto& part : params.partitions)
        target_partitions.push_back(part);

    std::vector<AddRule> add_rules;
    std::vector<AddRule> merge_rules;
    std::vector<std::string> hide_rules;

    // Process explicit hide rules from module configuration
    for (const auto& module : modules) {
        bool is_hymofs = false;
        for (const auto& id : plan.hymofs_module_ids) {
            if (id == module.id) {
                is_hymofs = true;
                break;
            }
        }
        if (!is_hymofs)
            continue;

        for (const auto& rule : module.rules) {
            if (rule.mode == "hide") {
                hide_rules.push_back(resolve_path_for_hymofs(rule.path));
            }
        }
    }

    // Iterate in reverse (Lowest Priority -> Highest Priority)
    for (auto it = modules.rbegin(); it != modules.rend(); ++it) {
        const auto& module = *it;

        bool is_hymofs = false;
        for (const auto& id : plan.hymofs_module_ids) {
            if (id == module.id) {
                is_hymofs = true;
                break;
            }
        }
        if (!is_hymofs)
            continue;

        fs::path mod_path = params.storage_root / module.id;

        std::string default_mode = module.mode;
        if (default_mode == "auto" || default_mode == "overlay" || default_mode == "magic")
            default_mode = "hymofs";

        for (const auto& part : target_partitions) {
            fs::path part_root = mod_path / part;
            if (!fs::exists(part_root))
                continue;

            try {
                for (auto dir_it = fs::recursive_directory_iterator(part_root);
                     dir_it != fs::recursive_directory_iterator(); ++dir_it) {
                    const auto& entry = *dir_it;
                    fs::path rel = fs::relative(entry.path(), mod_path);
                    fs::path virtual_path = fs::path("/") / rel;
                    std::string path_str = virtual_path.string();

                    std::string mode = default_mode;
                    size_t max_len = 0;
                    for (const auto& rule : module.rules) {
                        if (path_str == rule.path ||
                            (path_str.size() > rule.path.size() &&
                             path_str.compare(0, rule.path.size(), rule.path) == 0 &&
                             path_str[rule.path.size()] == '/')) {
                            if (rule.path.size() > max_len) {
                                max_len = rule.path.size();
                                mode = rule.mode;
                            }
                        }
                    }

                    if (mode != "hymofs" && mode != "auto")
                        continue;

                    if (entry.is_directory()) {
                        std::string final_virtual_path =
                            resolve_path_for_hymofs(virtual_path.string());
                        if (fs::exists(final_virtual_path) &&
                            fs::is_directory(final_virtual_path)) {
                            merge_rules.push_back(
                                {final_virtual_path, entry.path().string(), DT_DIR});
                            dir_it.disable_recursion_pending();
                            continue;
                        }
                    }

                    if (entry.is_regular_file() || entry.is_symlink()) {
                        if (entry.is_symlink()) {
                            if (fs::exists(virtual_path) && fs::is_directory(virtual_path)) {
                                LOG_WARN("Safety: Skipping symlink replacement for directory: " +
                                         virtual_path.string());
                                continue;
                            }
                        }
                        int type = DT_UNKNOWN;
                        if (entry.is_regular_file())
                            type = DT_REG;
                        else if (entry.is_symlink())
                            type = DT_LNK;
                        else if (entry.is_directory())
                            type = DT_DIR;
                        else if (entry.is_block_file())
                            type = DT_BLK;
                        else if (entry.is_character_file())
                            type = DT_CHR;
                        else if (entry.is_fifo())
                            type = DT_FIFO;
                        else if (entry.is_socket())
                            type = DT_SOCK;

                        std::string final_virtual_path =
                            resolve_path_for_hymofs(virtual_path.string());
                        add_rules.push_back({final_virtual_path, entry.path().string(), type});
                    } else if (entry.is_character_file()) {
                        struct stat st;
                        if (stat(entry.path().c_str(), &st) == 0) {
                            if (major(st.st_rdev) == 0 && minor(st.st_rdev) == 0) {
                                hide_rules.push_back(
                                    resolve_path_for_hymofs(virtual_path.string()));
                            }
                        }
                    }
                }
            } catch (const std::exception& e) {
                LOG_WARN("Error scanning module " + module.id + ": " + std::string(e.what()));
            }
        }
    }

    for (const auto& rule : add_rules) {
        HymoFS::add_rule(rule.src, rule.target, rule.type);
    }
    for (const auto& rule : merge_rules) {
        HymoFS::add_merge_rule(rule.src, rule.target);
    }
    for (const auto& path : hide_rules) {
        HymoFS::hide_path(path);
    }

    apply_user_hide_rules();

    HymoFS::set_enabled(true);

    LOG_INFO("HymoFS mappings updated.");
}

}  // namespace hymo
