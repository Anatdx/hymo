#pragma once

#include <string>
#include <vector>
#include <filesystem>
#include <optional>

namespace fs = std::filesystem;

namespace hymo {

class HymoFS {
public:
    static bool is_available();
    static bool clear_rules();
    static bool add_rule(const std::string& src, const std::string& target, int type = 0);
    static bool hide_path(const std::string& path);
    static bool inject_dir(const std::string& dir);
    
    // Helper to recursively walk a directory and generate rules
    // target_base: The system path where these files should appear (e.g., /system/app)
    // module_dir: The actual directory containing files (e.g., /data/adb/modules/mod1/system/app)
    static bool inject_directory(const fs::path& target_base, const fs::path& module_dir);
};

} // namespace hymo
