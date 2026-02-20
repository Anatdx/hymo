// core/inventory.hpp - Module inventory (no config)
#pragma once

#include <filesystem>
#include <string>
#include <vector>

namespace fs = std::filesystem;

namespace hymo {

struct ModuleRule {
    std::string path;
    std::string mode;  // "hymofs", "none", "hide"
};

struct Module {
    std::string id;
    fs::path source_path;
    std::string mode;  // "auto", "hymofs", "none"
    std::vector<ModuleRule> rules;
};

std::vector<Module> scan_modules(const fs::path& source_dir);

}  // namespace hymo
