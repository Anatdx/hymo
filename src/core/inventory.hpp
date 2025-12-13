// core/inventory.hpp - Module inventory
#pragma once

#include <string>
#include <vector>
#include <filesystem>
#include "../conf/config.hpp"

namespace fs = std::filesystem;

namespace hymo {

struct ModuleRule {
    std::string path;
    std::string mode; // "hymofs", "overlay", "magic", "none"
};

struct Module {
    std::string id;
    fs::path source_path;
    std::string mode; // "auto", "magic", etc.
    std::string name = "";
    std::string version = "";
    std::string author = "";
    std::string description = "";
    std::vector<ModuleRule> rules;
};

std::vector<Module> scan_modules(const fs::path& source_dir, const Config& config);

} // namespace hymo
