// core/params.hpp - Minimal library params (no config file)
#pragma once

#include <filesystem>
#include <string>
#include <vector>

namespace fs = std::filesystem;

namespace hymo {

struct HymoParams {
    fs::path moduledir = "/data/adb/modules";
    fs::path storage_root;  // mirror mount point or moduledir
    std::vector<std::string> partitions;  // extra beyond BUILTIN
    bool ignore_protocol_mismatch = false;
};

}  // namespace hymo
