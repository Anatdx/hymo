//! High-level HymoFS API

use crate::ioctl::{HymoIoctl, HYMO_PROTOCOL_VERSION};
use std::sync::OnceLock;

static CACHED: OnceLock<Option<HymoIoctl>> = OnceLock::new();

fn get_ioctl() -> Result<&'static HymoIoctl, std::io::Error> {
    CACHED.get_or_init(|| HymoIoctl::get_fd().ok());
    CACHED
        .get()
        .unwrap()
        .as_ref()
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "HymoFS LKM not available"))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HymoFSStatus {
    Available = 0,
    NotPresent = 1,
    KernelTooOld = 2,
    ModuleTooOld = 3,
}

impl From<i32> for HymoFSStatus {
    fn from(v: i32) -> Self {
        let expected = HYMO_PROTOCOL_VERSION as i32;
        match v {
            x if x == expected => HymoFSStatus::Available,
            x if x < 0 => HymoFSStatus::NotPresent,
            x if x < expected => HymoFSStatus::KernelTooOld,
            _ => HymoFSStatus::ModuleTooOld,
        }
    }
}

/// HymoFS high-level API
pub struct HymoFS;

impl HymoFS {
    pub const EXPECTED_PROTOCOL_VERSION: i32 = HYMO_PROTOCOL_VERSION as i32;

    /// Check HymoFS LKM status
    pub fn check_status() -> HymoFSStatus {
        match HymoIoctl::get_fd() {
            Ok(io) => match io.get_version() {
                Ok(v) => v.into(),
                Err(_) => HymoFSStatus::NotPresent,
            },
            Err(_) => HymoFSStatus::NotPresent,
        }
    }

    pub fn is_available() -> bool {
        Self::check_status() == HymoFSStatus::Available
    }

    pub fn get_protocol_version() -> Result<i32, std::io::Error> {
        get_ioctl()?.get_version()
    }

    pub fn clear_rules() -> Result<(), std::io::Error> {
        get_ioctl()?.clear_rules()
    }

    pub fn add_rule(src: &str, target: &str, type_: i32) -> Result<(), std::io::Error> {
        get_ioctl()?.add_rule(src, target, type_)
    }

    pub fn add_merge_rule(src: &str, target: &str) -> Result<(), std::io::Error> {
        get_ioctl()?.add_merge_rule(src, target)
    }

    pub fn delete_rule(src: &str) -> Result<(), std::io::Error> {
        get_ioctl()?.delete_rule(src)
    }

    pub fn hide_path(path: &str) -> Result<(), std::io::Error> {
        get_ioctl()?.hide_path(path)
    }

    pub fn set_mirror_path(path: &str) -> Result<(), std::io::Error> {
        get_ioctl()?.set_mirror_path(path)
    }

    pub fn set_debug(enable: bool) -> Result<(), std::io::Error> {
        get_ioctl()?.set_debug(enable)
    }

    pub fn set_stealth(enable: bool) -> Result<(), std::io::Error> {
        get_ioctl()?.set_stealth(enable)
    }

    pub fn set_enabled(enable: bool) -> Result<(), std::io::Error> {
        get_ioctl()?.set_enabled(enable)
    }

    pub fn set_uname(release: &str, version: &str) -> Result<(), std::io::Error> {
        get_ioctl()?.set_uname(release, version)
    }

    pub fn fix_mounts() -> Result<(), std::io::Error> {
        get_ioctl()?.fix_mounts()
    }

    pub fn get_active_rules() -> Result<String, std::io::Error> {
        get_ioctl()?.list_rules()
    }
}

/// C-compatible exports for NDK/FFI (no_std-friendly if needed)
#[no_mangle]
pub extern "C" fn hymo_check_status() -> i32 {
    HymoFS::check_status() as i32
}

#[no_mangle]
pub extern "C" fn hymo_clear_rules() -> i32 {
    HymoFS::clear_rules().map(|_| 0).unwrap_or(-1)
}

#[no_mangle]
pub extern "C" fn hymo_fix_mounts() -> i32 {
    HymoFS::fix_mounts().map(|_| 0).unwrap_or(-1)
}

#[no_mangle]
pub extern "C" fn hymo_set_enabled(enabled: i32) -> i32 {
    HymoFS::set_enabled(enabled != 0).map(|_| 0).unwrap_or(-1)
}
