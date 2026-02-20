#include "lkm.hpp"
#include "../defs.hpp"
#include "../mount/hymofs.hpp"
#include <cstdlib>

namespace fs = std::filesystem;
namespace hymo {

static constexpr int HYMO_SYSCALL_NR = 142;

bool lkm_is_loaded() {
    return HymoFS::is_available();
}

bool lkm_load() {
    if (!fs::exists(LKM_KO)) {
        return false;
    }
    std::string cmd = "insmod " + std::string(LKM_KO) + " hymo_syscall_nr=" +
                      std::to_string(HYMO_SYSCALL_NR) + " 2>/dev/null";
    int ret = std::system(cmd.c_str());
    return (ret == 0);
}

bool lkm_unload() {
    if (HymoFS::is_available()) {
        HymoFS::clear_rules();
    }
    int ret = std::system("rmmod hymofs_lkm 2>/dev/null");
    return (ret == 0);
}

}  // namespace hymo
