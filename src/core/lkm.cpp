#include "lkm.hpp"
#include "../defs.hpp"
#include "../mount/hymofs.hpp"
#include <cstdlib>
#include <fstream>
#include <sstream>

namespace fs = std::filesystem;
namespace hymo {

static constexpr int HYMO_SYSCALL_NR = 142;

static std::string read_file_first_line(const std::string& path) {
    std::ifstream f(path);
    std::string line;
    if (std::getline(f, line)) {
        return line;
    }
    return "";
}

static bool write_file(const std::string& path, const std::string& content) {
    std::ofstream f(path);
    if (!f)
        return false;
    f << content;
    return f.good();
}

static bool ensure_base_dir() {
    try {
        fs::create_directories(BASE_DIR);
        return true;
    } catch (...) {
        return false;
    }
}

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

bool lkm_set_autoload(bool on) {
    if (!ensure_base_dir())
        return false;
    return write_file(LKM_AUTOLOAD_FILE, on ? "1" : "0");
}

bool lkm_get_autoload() {
    std::string v = read_file_first_line(LKM_AUTOLOAD_FILE);
    if (v.empty())
        return true;  // default on
    return (v == "1" || v == "on" || v == "true");
}

}  // namespace hymo
