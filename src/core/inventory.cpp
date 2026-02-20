// core/inventory.cpp - Module inventory implementation
#include "inventory.hpp"
#include <algorithm>
#include <fstream>
#include <sstream>
#include "../defs.hpp"
#include "../utils.hpp"

namespace hymo {

static void parse_module_prop_mode(const fs::path& module_path, Module& module) {
    fs::path prop_file = module_path / "module.prop";
    if (!fs::exists(prop_file))
        return;
    std::ifstream file(prop_file);
    std::string line;
    while (std::getline(file, line)) {
        size_t eq = line.find('=');
        if (eq == std::string::npos)
            continue;
        std::string key = line.substr(0, eq);
        if (key == "mode") {
            module.mode = line.substr(eq + 1);
            break;
        }
    }
}

static void parse_module_rules(const fs::path& module_path, Module& module) {
    fs::path rules_file = module_path / "hymo_rules.conf";
    if (!fs::exists(rules_file))
        return;

    std::ifstream file(rules_file);
    std::string line;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#')
            continue;

        auto eq_pos = line.find('=');
        if (eq_pos != std::string::npos) {
            std::string path = line.substr(0, eq_pos);
            std::string mode = line.substr(eq_pos + 1);

            path.erase(0, path.find_first_not_of(" \t"));
            path.erase(path.find_last_not_of(" \t") + 1);
            mode.erase(0, mode.find_first_not_of(" \t"));
            mode.erase(mode.find_last_not_of(" \t") + 1);

            for (char& c : mode)
                c = std::tolower(c);

            module.rules.push_back({path, mode});
        }
    }
}

std::vector<Module> scan_modules(const fs::path& source_dir) {
    std::vector<Module> modules;

    if (!fs::exists(source_dir))
        return modules;

    try {
        for (const auto& entry : fs::directory_iterator(source_dir)) {
            if (!entry.is_directory())
                continue;

            std::string id = entry.path().filename().string();
            if (id == "hymo" || id == "lost+found" || id == ".git")
                continue;
            if (fs::exists(entry.path() / DISABLE_FILE_NAME) ||
                fs::exists(entry.path() / REMOVE_FILE_NAME) ||
                fs::exists(entry.path() / SKIP_MOUNT_FILE_NAME))
                continue;

            Module mod;
            mod.id = id;
            mod.source_path = entry.path();
            mod.mode = "auto";
            parse_module_rules(entry.path(), mod);
            parse_module_prop_mode(entry.path(), mod);
            modules.push_back(mod);
        }
        std::sort(modules.begin(), modules.end(),
                  [](const Module& a, const Module& b) { return a.id > b.id; });
    } catch (const std::exception& e) {
        LOG_ERROR("Failed to scan modules: " + std::string(e.what()));
    }
    return modules;
}

}  // namespace hymo
