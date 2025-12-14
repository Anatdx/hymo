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
    
    // Helper to recursively walk a directory and generate rules
    static bool add_rules_from_directory(const fs::path& target_base, const fs::path& module_dir);
    static bool remove_rules_from_directory(const fs::path& target_base, const fs::path& module_dir);
    
    // Inspection methods
    static std::string get_active_rules();
    static bool set_debug(bool enable);
    static bool set_stealth(bool enable);
};

} // namespace hymo
