// meta-hybrid_mount/src/utils.rs
use std::{
    fs::{self, create_dir, create_dir_all, remove_dir, remove_dir_all, remove_file, write, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    sync::OnceLock,
    os::fd::RawFd,
    ffi::CString,
};

use anyhow::{Context, Result, bail};
use rustix::mount::{mount, MountFlags};
#[cfg(any(target_os = "linux", target_os = "android"))]
use extattr::{Flags as XattrFlags, lsetxattr};

const SELINUX_XATTR: &str = "security.selinux";
const XATTR_TEST_FILE: &str = ".xattr_test";

// --- File Logger Implementation ---
struct FileLogger {
    file: Mutex<std::fs::File>,
}

impl log::Log for FileLogger {
    fn enabled(&self, _metadata: &log::Metadata) -> bool {
        true
    }

    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            let mut file = self.file.lock().unwrap();
            let _ = writeln!(
                file,
                "[{}] [{}] {}",
                record.level(),
                record.target(),
                record.args()
            );
        }
    }

    fn flush(&self) {
        let _ = self.file.lock().unwrap().flush();
    }
}

pub fn init_logger(verbose: bool, log_path: &Path) -> Result<()> {
    let level = if verbose {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    };

    if let Some(parent) = log_path.parent() {
        create_dir_all(parent)?;
    }

    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .append(true)
        .open(log_path)
        .with_context(|| format!("Failed to open log file: {}", log_path.display()))?;

    let logger = Box::new(FileLogger {
        file: Mutex::new(file),
    });

    log::set_boxed_logger(logger)
        .map(|()| log::set_max_level(level))
        .map_err(|e| anyhow::anyhow!("Failed to set logger: {}", e))?;

    Ok(())
}

pub fn lsetfilecon<P: AsRef<Path>>(path: P, con: &str) -> Result<()> {
    #[cfg(any(target_os = "linux", target_os = "android"))]
    {
        if let Err(e) = lsetxattr(&path, SELINUX_XATTR, con, XattrFlags::empty()) {
            let io_err = std::io::Error::from(e);
            // Log debug for permission denied as it's common on some FS
            log::debug!("lsetfilecon: {} -> {} failed: {}", path.as_ref().display(), con, io_err);
        }
    }
    Ok(())
}

#[cfg(any(target_os = "linux", target_os = "android"))]
pub fn lgetfilecon<P: AsRef<Path>>(path: P) -> Result<String> {
    let con = extattr::lgetxattr(&path, SELINUX_XATTR).with_context(|| {
        format!("Failed to get SELinux context for {}", path.as_ref().display())
    })?;
    Ok(String::from_utf8_lossy(&con).to_string())
}

#[cfg(not(any(target_os = "linux", target_os = "android")))]
pub fn lgetfilecon<P: AsRef<Path>>(_path: P) -> Result<String> {
    unimplemented!()
}

pub fn ensure_dir_exists<T: AsRef<Path>>(dir: T) -> Result<()> {
    if !dir.as_ref().exists() {
        log::debug!("Creating directory: {}", dir.as_ref().display());
        create_dir_all(&dir)?;
    }
    Ok(())
}

// --- Smart Storage & Stealth Utils ---

pub fn is_xattr_supported(path: &Path) -> bool {
    let test_file = path.join(XATTR_TEST_FILE);
    if let Err(e) = write(&test_file, b"test") {
        log::debug!("XATTR Check: Failed to create test file: {}", e);
        return false;
    }
    let result = lsetfilecon(&test_file, "u:object_r:system_file:s0");
    let supported = result.is_ok();
    log::debug!("XATTR Support on {}: {}", path.display(), supported);
    let _ = remove_file(test_file);
    supported
}

pub fn mount_tmpfs(target: &Path) -> Result<()> {
    ensure_dir_exists(target)?;
    log::debug!("Mounting tmpfs at {}", target.display());
    mount("tmpfs", target, "tmpfs", MountFlags::empty(), "mode=0755")
        .context("Failed to mount tmpfs")?;
    Ok(())
}

pub fn mount_image(image_path: &Path, target: &Path) -> Result<()> {
    ensure_dir_exists(target)?;
    log::debug!("Mounting image {} at {}", image_path.display(), target.display());
    let status = Command::new("mount")
        .args(["-t", "ext4", "-o", "loop,rw,noatime"])
        .arg(image_path)
        .arg(target)
        .status()
        .context("Failed to execute mount command")?;

    if !status.success() {
        bail!("Mount command failed");
    }
    Ok(())
}

pub fn sync_dir(src: &Path, dst: &Path) -> Result<()> {
    if !src.exists() { return Ok(()); }
    ensure_dir_exists(dst)?;

    // log::debug!("Copying {} to {}", src.display(), dst.display());
    let status = Command::new("cp")
        .arg("-af")
        .arg(format!("{}/.", src.display()))
        .arg(dst)
        .status()
        .context("Failed to execute cp command")?;

    if !status.success() {
        bail!("Failed to sync {} to {}", src.display(), dst.display());
    }

    let _ = Command::new("chcon")
        .arg("-R")
        .arg("u:object_r:system_file:s0")
        .arg(dst)
        .status();

    Ok(())
}

pub fn cleanup_temp_dir(temp_dir: &Path) {
    log::debug!("Cleaning up temp dir: {}", temp_dir.display());
    if let Err(e) = remove_dir_all(temp_dir) {
        log::warn!("Failed to clean up temp dir {}: {:#}", temp_dir.display(), e);
    }
}

pub fn ensure_temp_dir(temp_dir: &Path) -> Result<()> {
    if temp_dir.exists() {
        remove_dir_all(temp_dir).ok();
    }
    create_dir_all(temp_dir)?;
    Ok(())
}

pub fn select_temp_dir() -> Result<PathBuf> {
    let candidates = [
        "/debug_ramdisk",
        "/sbin",
        "/dev",
        "/mnt",
        "/data/local/tmp",
        "/data/adb/meta-hybrid"
    ];

    for base in candidates {
        let path = Path::new(base);
        if !path.is_dir() { continue; }

        let probe_dir = path.join(".mm_rw_probe");
        if create_dir(&probe_dir).is_ok() {
            let _ = remove_dir(&probe_dir);
            let work_dir = path.join("meta_hybrid_work");
            log::debug!("Selected temp dir base: {}", path.display());
            return Ok(work_dir);
        }
    }

    bail!("No writable temporary directory found! Checked: {:?}", candidates)
}

pub fn get_kernel_release() -> Result<String> {
    let output = Command::new("uname").arg("-r").output()?;
    let release = String::from_utf8(output.stdout)?.trim().to_string();
    Ok(release)
}

pub fn find_decoy_mount_point() -> Option<PathBuf> {
    let candidates = [
        "/oem",
        "/mnt/vendor/oem",
        "/mnt/vendor/persist",
        "/mnt/product/persist",
        "/acct",
        "/sys/kernel/tracing",
        "/debug_ramdisk/decoy",
    ];

    for path_str in candidates {
        let path = Path::new(path_str);
        if path.is_dir() {
            if let Ok(mut entries) = path.read_dir() {
                if entries.next().is_none() {
                    log::info!("Found empty decoy directory: {}", path_str);
                    return Some(path.to_path_buf());
                }
            }
        }
    }
    
    let dev_decoy = Path::new("/dev/.mnt_hybrid");
    if !dev_decoy.exists() {
        if create_dir(dev_decoy).is_ok() {
             return Some(dev_decoy.to_path_buf());
        }
    } else {
        return Some(dev_decoy.to_path_buf());
    }

    None
}

// --- kptr_restrict helper ---
pub struct ScopedKptrRestrict {
    original: String,
}

impl ScopedKptrRestrict {
    pub fn new() -> Self {
        let path = "/proc/sys/kernel/kptr_restrict";
        let original = fs::read_to_string(path).unwrap_or_else(|_| "2".to_string()).trim().to_string();
        
        // Set to 0 to expose symbols
        if let Err(e) = fs::write(path, "0") {
            log::warn!("Failed to lower kptr_restrict: {}", e);
        } else {
            log::debug!("Temporarily lowered kptr_restrict to 0 (was {})", original);
        }
        
        Self { original }
    }
}

impl Drop for ScopedKptrRestrict {
    fn drop(&mut self) {
        let path = "/proc/sys/kernel/kptr_restrict";
        if let Err(e) = fs::write(path, &self.original) {
            log::warn!("Failed to restore kptr_restrict: {}", e);
        } else {
            log::debug!("Restored kptr_restrict to {}", self.original);
        }
    }
}

// --- Try Umount Logic (KSU Style) ---

const KSU_INSTALL_MAGIC1: u32 = 0xDEADBEEF;
const KSU_IOCTL_ADD_TRY_UMOUNT: u32 = 0x40004b12;
const KSU_INSTALL_MAGIC2: u32 = 0xCAFEBABE;

static DRIVER_FD: OnceLock<RawFd> = OnceLock::new();

#[repr(C)]
struct KsuAddTryUmount {
    arg: u64,
    flags: u32,
    mode: u8,
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
pub fn send_unmountable<P>(target: P) -> Result<()>
where
    P: AsRef<Path>,
{
    use rustix::path::Arg;

    let path_ref = target.as_ref();
    let path_str = path_ref.as_str()?;
    
    let path = CString::new(path_str)?;
    let cmd = KsuAddTryUmount {
        arg: path.as_ptr() as u64,
        flags: 2,
        mode: 1,
    };
    let fd = *DRIVER_FD.get_or_init(grab_fd);

    unsafe {
        #[cfg(target_env = "gnu")]
        let ret = libc::ioctl(fd as libc::c_int, KSU_IOCTL_ADD_TRY_UMOUNT as u64, &cmd);

        #[cfg(not(target_env = "gnu"))]
        let ret = libc::ioctl(fd as libc::c_int, KSU_IOCTL_ADD_TRY_UMOUNT as i32, &cmd);

        if ret < 0 {
            // Optional: log debug but don't error out if KSU is not present
            // use std::io;
            // log::debug!("send_unmountable failed: {}", io::Error::last_os_error());
        }
    };

    Ok(())
}

#[cfg(not(any(target_os = "linux", target_os = "android")))]
pub fn send_unmountable<P>(_target: P) -> Result<()> {
    Ok(())
}
