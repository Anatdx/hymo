// core/state.hpp - Runtime state management
#pragma once

#include <string>
#include <vector>

namespace hymo {

struct RuntimeState {
    std::string storage_mode;
    std::string mount_point;
    std::vector<std::string> overlay_module_ids;
    std::vector<std::string> magic_module_ids;
    std::vector<std::string> hymofs_module_ids;
    bool nuke_active = false;
    
    bool save() const;
};

RuntimeState load_runtime_state();

} // namespace hymo
