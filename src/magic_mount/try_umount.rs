#[cfg(any(target_os = "linux", target_os = "android"))]
use std::{os::fd::RawFd, path::Path, sync::OnceLock, os::unix::ffi::OsStrExt};

#[cfg(any(target_os = "linux", target_os = "android"))]
use anyhow::Result;

const KSU_INSTALL_MAGIC1: u32 = 0xDEADBEEF;
const KSU_IOCTL_ADD_TRY_UMOUNT: u32 = 0x40004b12;
const KSU_INSTALL_MAGIC2: u32 = 0xCAFEBABE;

const CMD_SUSFS_ADD_TRY_UMOUNT: i32 = 0x55580;
const SUSFS_MAX_LEN_PATHNAME: usize = 256;

#[cfg(any(target_os = "linux", target_os = "android"))]
static DRIVER_FD: OnceLock<RawFd> = OnceLock::new();

#[repr(C)]
struct KsuAddTryUmount {
    arg: u64,
    flags: u32,
    mode: u8,
}

#[repr(C)]
struct StSusfsTryUmount {
    target_pathname: [u8; SUSFS_MAX_LEN_PATHNAME],
    mnt_mode: i32,
}

fn grab_fd() -> i32 {
    let mut fd = -1;
    unsafe {
        libc::syscall(
            libc::SYS_reboot,
            KSU_INSTALL_MAGIC1,
            KSU_INSTALL_MAGIC2,
            0,
            &mut fd,
        );
    };
    fd
}

#[cfg(any(target_os = "linux", target_os = "android"))]
pub(super) fn send_unmountable<P>(target: P) -> Result<()>
where
    P: AsRef<Path>,
{
    use std::ffi::CString;
    use rustix::path::Arg;

    let path_str = target.as_ref().as_str()?;
    let path = CString::new(path_str)?;
    let cmd = KsuAddTryUmount {
        arg: path.as_ptr() as u64,
        flags: 2,
        mode: 1,
    };
    let fd = *DRIVER_FD.get_or_init(|| grab_fd());

    // KSU Operation
    unsafe {
        #[cfg(target_env = "gnu")]
        let ret = libc::ioctl(fd as libc::c_int, KSU_IOCTL_ADD_TRY_UMOUNT as u64, &cmd);

        #[cfg(not(target_env = "gnu"))]
        let ret = libc::ioctl(fd as libc::c_int, KSU_IOCTL_ADD_TRY_UMOUNT as i32, &cmd);

        if ret == 0 {
            log::debug!("KSU: Scheduled unmount for {}", path_str);
        }
    };

    // SUSFS Operation
    if let Ok(abs_path) = std::fs::canonicalize(target.as_ref()) {
        let bytes = abs_path.as_os_str().as_bytes();
        
        if bytes.len() < SUSFS_MAX_LEN_PATHNAME {
            let mut info = StSusfsTryUmount {
                target_pathname: [0; SUSFS_MAX_LEN_PATHNAME],
                mnt_mode: 1,
            };
            
            info.target_pathname[..bytes.len()].copy_from_slice(bytes);
            
            let mut error: i32 = -1;
            
            unsafe {
                libc::prctl(
                    KSU_INSTALL_MAGIC1 as libc::c_int, 
                    CMD_SUSFS_ADD_TRY_UMOUNT as libc::c_ulong, 
                    &info as *const _ as libc::c_ulong, 
                    0 as libc::c_ulong, 
                    &mut error as *mut _ as libc::c_ulong
                );
            }

            if error == 0 {
                log::info!("SUSFS: Added try_umount for {}", abs_path.display());
            } else {
                // Only warn if it fails, it might not be installed
                log::debug!("SUSFS: Failed to add try_umount for {}, error: {}", abs_path.display(), error);
            }
        }
    }

    Ok(())
}

#[cfg(not(any(target_os = "linux", target_os = "android")))]
pub(super) fn send_unmountable<P>(_target: P) -> Result<()> {
    unimplemented!()
}
