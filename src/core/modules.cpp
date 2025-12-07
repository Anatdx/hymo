// core/modules.cpp - Module description updates implementation
#include "modules.hpp"
#include "inventory.hpp"
#include "../defs.hpp"
#include "../utils.hpp"
#include <fstream>
#include <sstream>
#include <iostream>

namespace hymo {

// Helper: Recursively check if a directory has any files
static bool has_files_recursive(const fs::path& path) {
    if (!fs::exists(path) || !fs::is_directory(path)) {
        return false;
    }
    
    try {
        for (const auto& entry : fs::recursive_directory_iterator(path)) {
            if (fs::is_regular_file(entry) || fs::is_symlink(entry)) {
                return true;
            }
        }
    } catch (...) {
        return true;
    }
    
    return false;
}

// Helper: Check if module has content for any partition (builtin or extra)
static bool has_content(const fs::path& module_path, const std::vector<std::string>& all_partitions) {
    for (const auto& partition : all_partitions) {
        fs::path part_path = module_path / partition;
        if (has_files_recursive(part_path)) {
            return true;
        }
    }
    return false;
}

void update_module_description(
    bool success,
    const std::string& storage_mode,
    bool nuke_active,
    size_t overlay_count,
    size_t magic_count,
    size_t hymofs_count
) {
    if (!fs::exists(MODULE_PROP_FILE)) {
        LOG_WARN("module.prop not found, skipping update");
        return;
    }
    
    std::ostringstream desc;
    desc << (success ? "😋" : "😭") << " Hymo";
    if (nuke_active) {
        desc << " 🐾";
    }
    desc << " | ";
    desc << "Storage: " << storage_mode << " | ";
    desc << "Modules: " << overlay_count << " Overlay + " << magic_count << " Magic + " << hymofs_count << " HymoFS";
    
    // Read current file
    std::ifstream infile(MODULE_PROP_FILE);
    std::string content;
    std::string line;
    bool desc_updated = false;
    
    while (std::getline(infile, line)) {
        if (line.find("description=") == 0) {
            content += "description=" + desc.str() + "\n";
            desc_updated = true;
        } else {
            content += line + "\n";
        }
    }
    infile.close();
    
    if (!desc_updated) {
        content += "description=" + desc.str() + "\n";
    }
    
    // Write back
    std::ofstream outfile(MODULE_PROP_FILE);
    outfile << content;
    outfile.close();
    
    LOG_DEBUG("Updated module description");
}

void print_module_list(const Config& config) {
    auto modules = scan_modules(config.moduledir, config);
    
    // Build complete partition list (builtin + extra)
    std::vector<std::string> all_partitions = BUILTIN_PARTITIONS;
    for (const auto& part : config.partitions) {
        all_partitions.push_back(part);
    }
    
    // Filter modules with actual content (including extra partitions)
    std::vector<Module> filtered_modules;
    for (const auto& module : modules) {
        if (has_content(module.source_path, all_partitions)) {
            filtered_modules.push_back(module);
        }
    }
    
    std::cout << "{\n";
    std::cout << "  \"count\": " << filtered_modules.size() << ",\n";
    std::cout << "  \"modules\": [\n";
    
    for (size_t i = 0; i < filtered_modules.size(); ++i) {
        std::cout << "    {\n";
        std::cout << "      \"id\": \"" << filtered_modules[i].id << "\",\n";
        std::cout << "      \"path\": \"" << filtered_modules[i].source_path.string() << "\",\n";
        std::cout << "      \"mode\": \"" << filtered_modules[i].mode << "\"\n";
        std::cout << "    }";
        if (i < filtered_modules.size() - 1) {
            std::cout << ",";
        }
        std::cout << "\n";
    }
    
    std::cout << "  ]\n";
    std::cout << "}\n";
}

} // namespace hymo
