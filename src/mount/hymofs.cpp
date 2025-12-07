#include "hymofs.hpp"
#include "../utils.hpp"
#include <fstream>
#include <iostream>
#include <sys/stat.h>
#include <unistd.h>

namespace hymo {

const char* HYMO_CTL = "/proc/hymo_ctl";

bool HymoFS::is_available() {
    return fs::exists(HYMO_CTL);
}

bool HymoFS::clear_rules() {
    std::ofstream ctl(HYMO_CTL);
    if (!ctl) return false;
    ctl << "clear" << std::endl;
    return ctl.good();
}

bool HymoFS::add_rule(const std::string& src, const std::string& target, int type) {
    std::ofstream ctl(HYMO_CTL);
    if (!ctl) return false;
    ctl << "add " << src << " " << target << " " << type << std::endl;
    return ctl.good();
}

bool HymoFS::hide_path(const std::string& path) {
    std::ofstream ctl(HYMO_CTL);
    if (!ctl) return false;
    ctl << "hide " << path << std::endl;
    return ctl.good();
}

bool HymoFS::inject_dir(const std::string& dir) {
    std::ofstream ctl(HYMO_CTL);
    if (!ctl) return false;
    ctl << "inject " << dir << std::endl;
    return ctl.good();
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

} // namespace hymo
