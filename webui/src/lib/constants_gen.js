// Auto-generated constants from C++ defs.hpp
// This file is synchronized with src/defs.hpp

// Standard Android partitions
export const BUILTIN_PARTITIONS = ['system', 'vendor', 'product', 'system_ext', 'odm', 'oem'];

export const C_PATHS = {
  // Directories
  FALLBACK_CONTENT_DIR: '/data/adb/hymo/img_mnt/',
  BASE_DIR: '/data/adb/hymo/',
  RUN_DIR: '/data/adb/hymo/run/',
  DAEMON_STATE: '/data/adb/hymo/run/daemon_state.json',
  STATE_FILE: '/data/adb/hymo/run/daemon_state.json',
  DAEMON_LOG: '/data/adb/hymo/daemon.log',
  SYSTEM_RW_DIR: '/data/adb/hymo/rw',
  MODULE_PROP_FILE: '/data/adb/modules/hymo/module.prop',
  
  // Config paths
  CONFIG: '/data/adb/hymo/config.toml',
  MODE_CONFIG: '/data/adb/hymo/module_mode.conf',
  
  // Binary path
  BINARY: '/data/adb/modules/hymo/hymo',

  // Marker files
  DISABLE_FILE_NAME: 'disable',
  REMOVE_FILE_NAME: 'remove',
  SKIP_MOUNT_FILE_NAME: 'skip_mount',
  REPLACE_DIR_FILE_NAME: '.replace',

  // OverlayFS
  OVERLAY_SOURCE: 'KSU',
  KSU_OVERLAY_SOURCE: 'KSU',

  // XAttr
  REPLACE_DIR_XATTR: 'trusted.overlay.opaque',
  SELINUX_XATTR: 'security.selinux',
  DEFAULT_SELINUX_CONTEXT: 'u:object_r:system_file:s0'
};
