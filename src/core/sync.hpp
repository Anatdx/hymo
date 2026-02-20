// core/sync.hpp - Module content synchronization
#pragma once

#include "inventory.hpp"
#include "params.hpp"
#include <filesystem>

namespace fs = std::filesystem;

namespace hymo {

void perform_sync(const std::vector<Module>& modules, const HymoParams& params);

}  // namespace hymo
