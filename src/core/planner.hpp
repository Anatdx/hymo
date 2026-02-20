// core/planner.hpp - Mount planning (HymoFS-only minimal)
#pragma once

#include "inventory.hpp"
#include "params.hpp"
#include <filesystem>
#include <vector>

namespace fs = std::filesystem;

namespace hymo {

struct MountPlan {
    std::vector<std::string> hymofs_module_ids;
};

MountPlan generate_plan(const HymoParams& params, const std::vector<Module>& modules);

void update_hymofs_mappings(const HymoParams& params, const std::vector<Module>& modules,
                            MountPlan& plan);

}  // namespace hymo
