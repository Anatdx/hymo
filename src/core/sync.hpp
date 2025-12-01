// core/sync.hpp - Module content synchronization
#pragma once

#include "inventory.hpp"
#include "../conf/config.hpp"
#include <filesystem>

namespace fs = std::filesystem;

namespace hymo {

void perform_sync(const std::vector<Module>& modules, const fs::path& storage_root, const Config& config);

} // namespace hymo
