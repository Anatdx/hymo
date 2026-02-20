// core/executor.cpp - Mount execution (HymoFS-only minimal: no-op)
#include "executor.hpp"
#include "../defs.hpp"
#include "../utils.hpp"

namespace hymo {

ExecutionResult execute_plan(const MountPlan& plan, const Config& config, bool hymofs_active) {
    (void)plan;
    (void)config;
    (void)hymofs_active;
    if (!plan.hymofs_module_ids.empty()) {
        LOG_INFO("HymoFS modules handled by Fast Path controller.");
    }
    return ExecutionResult{};
}

}  // namespace hymo
