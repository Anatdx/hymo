// hymo.hpp - HymoFS minimal library API
#pragma once

#include "core/params.hpp"
#include "core/inventory.hpp"
#include "core/planner.hpp"
#include "core/state.hpp"
#include "core/sync.hpp"
#include "core/user_rules.hpp"
#include "mount/hymofs.hpp"

namespace hymo {

// Library entry: scan -> sync -> plan -> update mappings
inline void hymo_mount(HymoParams& params) {
    auto modules = scan_modules(params.moduledir);
    perform_sync(modules, params);
    auto plan = generate_plan(params, modules);
    update_hymofs_mappings(params, modules, plan);
    RuntimeState state;
    state.storage_mode = "mirror";
    state.mount_point = params.storage_root.string();
    state.hymofs_module_ids = plan.hymofs_module_ids;
    state.pid = 0;
    state.save();
}

}  // namespace hymo
