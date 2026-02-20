//! HymoFS ioctl - bindings from hymo_magic.h (single source of truth)
//!
//! Protocol structs and constants are generated from ../src/mount/hymo_magic.h.
//! Ioctl numbers use Linux _IOW/_IOR/_IO formula to match kernel.

//! Generated from ../src/mount/hymo_magic.h - do not hand-edit.
include!(concat!(env!("OUT_DIR"), "/hymo_magic.rs"));

use libc::{c_int, c_void};
use std::ffi::CString;
use std::os::raw::c_char;

// Linux ioctl encoding (must match kernel's sys/ioctl.h)
#[allow(non_snake_case)]
mod ioc {
    const _IOC_NONE: u32 = 0;
    const _IOC_WRITE: u32 = 1;
    const _IOC_READ: u32 = 2;
    const _IOC_NRSHIFT: u32 = 0;
    const _IOC_TYPESHIFT: u32 = 8;
    const _IOC_SIZESHIFT: u32 = 16;
    const _IOC_DIRSHIFT: u32 = 30;

    const fn _IOC(dir: u32, ty: u32, nr: u32, size: u32) -> u32 {
        (dir << _IOC_DIRSHIFT) | (ty << _IOC_TYPESHIFT) | (nr << _IOC_NRSHIFT) | (size << _IOC_SIZESHIFT)
    }
    pub const fn _IOW(ty: u32, nr: u32, size: u32) -> u32 {
        _IOC(_IOC_WRITE, ty, nr, size)
    }
    pub const fn _IOR(ty: u32, nr: u32, size: u32) -> u32 {
        _IOC(_IOC_READ, ty, nr, size)
    }
    pub const fn _IOWR(ty: u32, nr: u32, size: u32) -> u32 {
        _IOC(_IOC_READ | _IOC_WRITE, ty, nr, size)
    }
    pub const fn _IO(ty: u32, nr: u32) -> u32 {
        _IOC(_IOC_NONE, ty, nr, 0)
    }
}
use ioc::{_IO, _IOR, _IOW, _IOWR};

const HYMO_IOC_MAGIC: u32 = b'H' as u32;

// Ioctl numbers - computed from hymo_magic.h struct sizes (Linux formula)
fn ioctl_add_rule() -> u32 {
    _IOW(HYMO_IOC_MAGIC, 1, std::mem::size_of::<hymo_syscall_arg>() as u32)
}
fn ioctl_del_rule() -> u32 {
    _IOW(HYMO_IOC_MAGIC, 2, std::mem::size_of::<hymo_syscall_arg>() as u32)
}
fn ioctl_hide_rule() -> u32 {
    _IOW(HYMO_IOC_MAGIC, 3, std::mem::size_of::<hymo_syscall_arg>() as u32)
}
fn ioctl_clear_all() -> u32 {
    _IO(HYMO_IOC_MAGIC, 5)
}
fn ioctl_get_version() -> u32 {
    _IOR(HYMO_IOC_MAGIC, 6, 4)
}
fn ioctl_list_rules() -> u32 {
    _IOWR(HYMO_IOC_MAGIC, 7, std::mem::size_of::<hymo_syscall_list_arg>() as u32)
}
fn ioctl_set_debug() -> u32 {
    _IOW(HYMO_IOC_MAGIC, 8, 4)
}
fn ioctl_reorder_mnt_id() -> u32 {
    _IO(HYMO_IOC_MAGIC, 9)
}
fn ioctl_set_stealth() -> u32 {
    _IOW(HYMO_IOC_MAGIC, 10, 4)
}
fn ioctl_add_merge_rule() -> u32 {
    _IOW(HYMO_IOC_MAGIC, 12, std::mem::size_of::<hymo_syscall_arg>() as u32)
}
fn ioctl_set_mirror_path() -> u32 {
    _IOW(HYMO_IOC_MAGIC, 14, std::mem::size_of::<hymo_syscall_arg>() as u32)
}
fn ioctl_set_uname() -> u32 {
    _IOW(HYMO_IOC_MAGIC, 17, std::mem::size_of::<hymo_spoof_uname>() as u32)
}
fn ioctl_set_enabled() -> u32 {
    _IOW(HYMO_IOC_MAGIC, 20, 4)
}

/// Low-level HymoFS ioctl interface
pub struct HymoIoctl {
    fd: c_int,
}

impl HymoIoctl {
    /// Get anonymous fd from kernel (prctl or syscall)
    #[cfg(any(target_os = "android", target_os = "linux"))]
    pub fn get_fd() -> Result<Self, std::io::Error> {
        let mut fd: c_int = -1;

        for wait in 0..4 {
            if wait > 0 {
                std::thread::sleep(std::time::Duration::from_secs(1));
            }

            unsafe {
                libc::prctl(
                    HYMO_PRCTL_GET_FD as libc::c_int,
                    &mut fd as *mut _ as libc::c_ulong,
                    0,
                    0,
                    0,
                );
            }

            if fd >= 0 {
                return Ok(Self { fd });
            }

            for attempt in 0..2 {
                if attempt > 0 {
                    std::thread::sleep(std::time::Duration::from_millis(80));
                }
                unsafe {
                    libc::syscall(
                        libc::SYS_reboot,
                        HYMO_MAGIC1 as libc::c_long,
                        HYMO_MAGIC2 as libc::c_long,
                        HYMO_CMD_GET_FD as libc::c_long,
                        &mut fd as *mut _,
                    );
                }
                if fd >= 0 {
                    return Ok(Self { fd });
                }
            }
        }

        Err(std::io::Error::last_os_error())
    }

    #[cfg(not(any(target_os = "android", target_os = "linux")))]
    pub fn get_fd() -> Result<Self, std::io::Error> {
        Err(std::io::Error::new(
            std::io::ErrorKind::Unsupported,
            "HymoFS only supported on Android/Linux",
        ))
    }

    fn ioctl(&self, cmd: u32, arg: *mut c_void) -> Result<(), std::io::Error> {
        #[cfg(any(target_os = "android", target_os = "linux"))]
        let ret = unsafe { libc::ioctl(self.fd, cmd as libc::c_int, arg) };
        #[cfg(not(any(target_os = "android", target_os = "linux")))]
        let ret = unsafe { libc::ioctl(self.fd, cmd as libc::c_ulong, arg) };
        if ret < 0 {
            Err(std::io::Error::last_os_error())
        } else {
            Ok(())
        }
    }

    pub fn get_version(&self) -> Result<i32, std::io::Error> {
        let mut version: c_int = 0;
        self.ioctl(ioctl_get_version(), &mut version as *mut _ as *mut c_void)?;
        Ok(version)
    }

    pub fn clear_rules(&self) -> Result<(), std::io::Error> {
        self.ioctl(ioctl_clear_all(), std::ptr::null_mut())
    }

    pub fn add_rule(&self, src: &str, target: &str, type_: c_int) -> Result<(), std::io::Error> {
        let src_c = CString::new(src).map_err(|_| std::io::ErrorKind::InvalidInput)?;
        let target_c = CString::new(target).map_err(|_| std::io::ErrorKind::InvalidInput)?;
        let arg = hymo_syscall_arg {
            src: src_c.as_ptr(),
            target: target_c.as_ptr(),
            type_: type_,
        };
        self.ioctl(ioctl_add_rule(), &arg as *const _ as *mut c_void)
    }

    pub fn add_merge_rule(&self, src: &str, target: &str) -> Result<(), std::io::Error> {
        let src_c = CString::new(src).map_err(|_| std::io::ErrorKind::InvalidInput)?;
        let target_c = CString::new(target).map_err(|_| std::io::ErrorKind::InvalidInput)?;
        let arg = hymo_syscall_arg {
            src: src_c.as_ptr(),
            target: target_c.as_ptr(),
            type_: 0,
        };
        self.ioctl(ioctl_add_merge_rule(), &arg as *const _ as *mut c_void)
    }

    pub fn delete_rule(&self, src: &str) -> Result<(), std::io::Error> {
        let src_c = CString::new(src).map_err(|_| std::io::ErrorKind::InvalidInput)?;
        let arg = hymo_syscall_arg {
            src: src_c.as_ptr(),
            target: std::ptr::null(),
            type_: 0,
        };
        self.ioctl(ioctl_del_rule(), &arg as *const _ as *mut c_void)
    }

    pub fn hide_path(&self, path: &str) -> Result<(), std::io::Error> {
        let path_c = CString::new(path).map_err(|_| std::io::ErrorKind::InvalidInput)?;
        let arg = hymo_syscall_arg {
            src: path_c.as_ptr(),
            target: std::ptr::null(),
            type_: 0,
        };
        self.ioctl(ioctl_hide_rule(), &arg as *const _ as *mut c_void)
    }

    pub fn set_mirror_path(&self, path: &str) -> Result<(), std::io::Error> {
        let path_c = CString::new(path).map_err(|_| std::io::ErrorKind::InvalidInput)?;
        let arg = hymo_syscall_arg {
            src: path_c.as_ptr(),
            target: std::ptr::null(),
            type_: 0,
        };
        self.ioctl(ioctl_set_mirror_path(), &arg as *const _ as *mut c_void)
    }

    pub fn set_debug(&self, enable: bool) -> Result<(), std::io::Error> {
        let val: c_int = if enable { 1 } else { 0 };
        self.ioctl(ioctl_set_debug(), &val as *const _ as *mut c_void)
    }

    pub fn set_stealth(&self, enable: bool) -> Result<(), std::io::Error> {
        let val: c_int = if enable { 1 } else { 0 };
        self.ioctl(ioctl_set_stealth(), &val as *const _ as *mut c_void)
    }

    pub fn set_enabled(&self, enable: bool) -> Result<(), std::io::Error> {
        let val: c_int = if enable { 1 } else { 0 };
        self.ioctl(ioctl_set_enabled(), &val as *const _ as *mut c_void)
    }

    pub fn fix_mounts(&self) -> Result<(), std::io::Error> {
        self.ioctl(ioctl_reorder_mnt_id(), std::ptr::null_mut())
    }

    pub fn set_uname(&self, release: &str, version: &str) -> Result<(), std::io::Error> {
        let mut uname_data: hymo_spoof_uname = unsafe { std::mem::zeroed() };
        let copy_into = |dst: &mut [libc::c_char], s: &str| {
            let bytes = s.as_bytes();
            let len = (bytes.len()).min((HYMO_UNAME_LEN - 1) as usize);
            for (i, &b) in bytes.iter().take(len).enumerate() {
                dst[i] = b as libc::c_char;
            }
            dst[len] = 0;
        };
        copy_into(&mut uname_data.release, release);
        copy_into(&mut uname_data.version, version);
        self.ioctl(ioctl_set_uname(), &mut uname_data as *mut _ as *mut c_void)
    }

    pub fn list_rules(&self) -> Result<String, std::io::Error> {
        let buf_size = 16 * 1024;
        let mut buf = vec![0u8; buf_size];
        let arg = hymo_syscall_list_arg {
            buf: buf.as_mut_ptr() as *mut c_char,
            size: buf_size,
        };
        self.ioctl(ioctl_list_rules(), &arg as *const _ as *mut c_void)?;
        let len = buf.iter().position(|&b| b == 0).unwrap_or(buf_size);
        Ok(String::from_utf8_lossy(&buf[..len]).into_owned())
    }
}
