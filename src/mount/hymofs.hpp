#pragma once

#include <string>
#include <vector>
#include <filesystem>
#include "defs.hpp"

namespace fs = std::filesystem;

namespace hymo {

enum class HymoFSStatus {
    Available,
    NotPresent,
    KernelTooOld,
    ModuleTooOld
};

class HymoFS {
public:
    static constexpr int EXPECTED_PROTOCOL_VERSION = HYMO_PROTOCOL_VERSION;


    static HymoFSStatus check_status();
    static bool is_available();
    static int get_protocol_version();
    static bool clear_rules();
    static bool add_rule(const std::string& src, const std::string& target, int type = 0);
    static bool delete_rule(const std::string& src);
    static bool hide_path(const std::string& path);
    static bool inject_dir(const std::string& dir);
    
    // Helper to recursively walk a directory and generate rules
    // target_base: The system path where these files should appear (e.g., /system/app)
    // module_dir: The actual directory containing files (e.g., /data/adb/modules/mod1/system/app)
    static bool inject_directory(const fs::path& target_base, const fs::path& module_dir);
    static bool delete_directory_rules(const fs::path& target_base, const fs::path& module_dir);
    
    // New methods for inspection
    static std::string get_active_rules();
};

} // namespace hymo
