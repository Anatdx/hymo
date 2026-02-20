/**
 * hymo-minimal C API for NDK/CMake linking
 *
 * Link: -lhymo_minimal
 * Include: hymo_minimal.h
 *
 * Build:
 *   cargo ndk -t arm64-v8a -t armeabi-v7a -t x86_64 build --release
 *   Output: target/<triple>/release/libhymo_minimal.a
 */

#ifndef HYMO_MINIMAL_H
#define HYMO_MINIMAL_H

#ifdef __cplusplus
extern "C" {
#endif

/** HymoFS status: 0=Available, 1=NotPresent, 2=KernelTooOld, 3=ModuleTooOld */
int hymo_check_status(void);

/** Clear all HymoFS rules. Returns 0 on success, -1 on error. */
int hymo_clear_rules(void);

/** Fix mount namespace (reorder mnt_id). Returns 0 on success, -1 on error. */
int hymo_fix_mounts(void);

/** Set HymoFS enabled state. enabled: 0=off, non-zero=on. Returns 0 on success. */
int hymo_set_enabled(int enabled);

#ifdef __cplusplus
}
#endif

#endif /* HYMO_MINIMAL_H */
