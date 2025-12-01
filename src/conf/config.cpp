// conf/config.cpp - Configuration implementation
#include "config.hpp"
#include "../defs.hpp"
#include "../utils.hpp"
#include <fstream>
#include <sstream>
#include <iostream>

namespace hymo {

Config Config::load_default() {
    Config config;
    // Try to load from default location if exists
    fs::path default_path = fs::path(BASE_DIR) / "config.toml";
    if (fs::exists(default_path)) {
        try {
            return from_file(default_path);
        } catch (...) {
            LOG_WARN("Failed to load default config, using defaults");
        }
    }
    return config;
}

Config Config::from_file(const fs::path& path) {
    Config config;
    // Simple TOML-like parser (basic implementation)
    // In production, you'd use a proper TOML library
    std::ifstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open config file");
    }
    
    std::string line;
    while (std::getline(file, line)) {
        // Skip comments and empty lines
        if (line.empty() || line[0] == '#') continue;
        
        // Simple key=value parsing
        auto eq_pos = line.find('=');
        if (eq_pos != std::string::npos) {
            std::string key = line.substr(0, eq_pos);
            std::string value = line.substr(eq_pos + 1);
            
            // Trim whitespace and quotes
            key.erase(0, key.find_first_not_of(" \t"));
            key.erase(key.find_last_not_of(" \t") + 1);
            value.erase(0, value.find_first_not_of(" \t\""));
            value.erase(value.find_last_not_of(" \t\"") + 1);
            
            if (key == "moduledir") config.moduledir = value;
            else if (key == "tempdir") config.tempdir = value;
            else if (key == "mountsource") config.mountsource = value;
            else if (key == "verbose") config.verbose = (value == "true");
            else if (key == "force_ext4") config.force_ext4 = (value == "true");
            else if (key == "disable_umount") config.disable_umount = (value == "true");
            else if (key == "enable_nuke") config.enable_nuke = (value == "true");
            else if (key == "partitions") {
                // Parse comma-separated partitions
                std::stringstream ss(value);
                std::string part;
                while (std::getline(ss, part, ',')) {
                    // Trim whitespace
                    part.erase(0, part.find_first_not_of(" \t"));
                    part.erase(part.find_last_not_of(" \t") + 1);
                    if (!part.empty()) {
                        config.partitions.push_back(part);
                    }
                }
            }
        }
    }
    
    config.module_modes = load_module_modes();
    return config;
}

bool Config::save_to_file(const fs::path& path) const {
    std::ofstream file(path);
    if (!file.is_open()) {
        return false;
    }
    
    file << "# Hymo Configuration\n";
    file << "moduledir = \"" << moduledir.string() << "\"\n";
    if (!tempdir.empty()) {
        file << "tempdir = \"" << tempdir.string() << "\"\n";
    }
    file << "mountsource = \"" << mountsource << "\"\n";
    file << "verbose = " << (verbose ? "true" : "false") << "\n";
    file << "force_ext4 = " << (force_ext4 ? "true" : "false") << "\n";
    file << "disable_umount = " << (disable_umount ? "true" : "false") << "\n";
    file << "enable_nuke = " << (enable_nuke ? "true" : "false") << "\n";
    
    // Write partitions
    if (!partitions.empty()) {
        file << "partitions = \"";
        for (size_t i = 0; i < partitions.size(); ++i) {
            file << partitions[i];
            if (i < partitions.size() - 1) file << ",";
        }
        file << "\"\n";
    }
    
    return true;
}

void Config::merge_with_cli(
    const fs::path& moduledir_override,
    const fs::path& tempdir_override,
    const std::string& mountsource_override,
    bool verbose_override,
    const std::vector<std::string>& partitions_override
) {
    if (!moduledir_override.empty()) {
        moduledir = moduledir_override;
    }
    if (!tempdir_override.empty()) {
        tempdir = tempdir_override;
    }
    if (!mountsource_override.empty()) {
        mountsource = mountsource_override;
    }
    if (verbose_override) {
        verbose = true;
    }
    if (!partitions_override.empty()) {
        partitions = partitions_override;
    }
}

std::map<std::string, std::string> load_module_modes() {
    std::map<std::string, std::string> modes;
    
    // Load from config file if exists
    fs::path mode_file = fs::path(BASE_DIR) / "module_mode.conf";
    if (fs::exists(mode_file)) {
        std::ifstream file(mode_file);
        std::string line;
        while (std::getline(file, line)) {
            // Skip empty lines and comments
            if (line.empty() || line[0] == '#') continue;
            
            // Trim leading whitespace
            size_t start = line.find_first_not_of(" \t");
            if (start == std::string::npos) continue;
            if (line[start] == '#') continue;
            
            auto eq_pos = line.find('=');
            if (eq_pos != std::string::npos) {
                std::string module_id = line.substr(0, eq_pos);
                std::string mode = line.substr(eq_pos + 1);
                
                // Trim whitespace
                module_id.erase(0, module_id.find_first_not_of(" \t"));
                module_id.erase(module_id.find_last_not_of(" \t") + 1);
                mode.erase(0, mode.find_first_not_of(" \t"));
                mode.erase(mode.find_last_not_of(" \t") + 1);
                
                // Convert mode to lowercase
                for (char& c : mode) {
                    c = std::tolower(c);
                }
                
                modes[module_id] = mode;
            }
        }
    }
    
    return modes;
}

} // namespace hymo
