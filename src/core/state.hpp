// core/state.hpp - Runtime state management (HymoFS minimal)
#pragma once

#include <string>
#include <vector>

namespace hymo {

struct RuntimeState {
    std::string storage_mode;
    std::string mount_point;
    std::vector<std::string> hymofs_module_ids;
    int pid = 0;

    bool save() const;
};

RuntimeState load_runtime_state();

}  // namespace hymo
