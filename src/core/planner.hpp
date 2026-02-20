// core/planner.hpp - Mount planning (HymoFS-only minimal)
#pragma once

#include "../conf/config.hpp"
#include "inventory.hpp"
#include <filesystem>
#include <map>
#include <vector>

namespace fs = std::filesystem;

namespace hymo {

struct MountPlan {
  std::vector<std::string> hymofs_module_ids;
};

MountPlan generate_plan(const Config &config,
                        const std::vector<Module> &modules,
                        const fs::path &storage_root);

void update_hymofs_mappings(const Config &config,
                            const std::vector<Module> &modules,
                            const fs::path &storage_root, MountPlan &plan);

} // namespace hymo
