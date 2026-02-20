#pragma once

namespace hymo {

// LKM management for HymoFS kernel module
bool lkm_load();
bool lkm_unload();
bool lkm_is_loaded();

}  // namespace hymo
