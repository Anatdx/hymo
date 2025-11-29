// meta-hybrid_mount/src/nuke.rs
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};
use crate::{defs, utils};

fn get_android_version() -> Option<String> {
    let output = Command::new("getprop")
        .arg("ro.build.version.release")
        .output()
        .ok()?;
    String::from_utf8(output.stdout).ok().map(|s| s.trim().to_string())
}

/// Fallback: Attempt to load Nuke LKM directly
fn try_lkm_load(mnt_point: &Path) -> bool {
    log::info!("Attempting to deploy Paw Pad (LKM) for stealth...");
    
    let uname = match utils::get_kernel_release() {
        Ok(v) => v,
        Err(e) => {
            log::error!("Failed to get kernel release: {}", e);
            return false;
        }
    };

    let lkm_dir = Path::new(defs::MODULE_LKM_DIR);
    if !lkm_dir.exists() {
        log::warn!("LKM directory not found at {}", lkm_dir.display());
        return false;
    }

    let android_ver = get_android_version().unwrap_or_default();
    let parts: Vec<&str> = uname.split('.').collect();
    
    if parts.len() < 2 { return false; }
    let kernel_short = format!("{}.{}", parts[0], parts[1]); 

    let mut target_ko = None;
    let mut entries = Vec::new();
    
    if let Ok(dir) = fs::read_dir(lkm_dir) {
        for entry in dir.flatten() {
            entries.push(entry.path());
        }
    }

    // 1. Try exact match
    if !android_ver.is_empty() {
        let pattern_android = format!("android{}", android_ver);
        for path in &entries {
            let name = path.file_name().unwrap().to_string_lossy();
            if name.contains(&kernel_short) && name.contains(&pattern_android) {
                target_ko = Some(path.clone());
                log::info!("Found Paw Pad (LKM): {}", name);
                break;
            }
        }
    }

    // 2. Fallback match
    if target_ko.is_none() {
        for path in &entries {
            let name = path.file_name().unwrap().to_string_lossy();
            if name.contains(&kernel_short) {
                target_ko = Some(path.clone());
                log::info!("Found compatible Paw Pad (LKM): {}", name);
                break;
            }
        }
    }

    let ko_path = match target_ko {
        Some(p) => p,
        None => {
            log::warn!("No matching Paw Pad found for kernel {}", uname);
            return false;
        }
    };

    let _kptr_guard = utils::ScopedKptrRestrict::new();

    let cmd = Command::new("sh")
        .arg("-c")
        .arg("grep \" ext4_unregister_sysfs$\" /proc/kallsyms | awk '{print \"0x\"$1}'")
        .output();
        
    let sym_addr = match cmd {
        Ok(o) if o.status.success() => String::from_utf8(o.stdout).unwrap_or_default().trim().to_string(),
        _ => return false,
    };

    if sym_addr.is_empty() || sym_addr == "0x0000000000000000" {
        log::warn!("Symbol ext4_unregister_sysfs not found or masked.");
        return false;
    }

    // Silent execution: suppress stderr to hide "Operation not permitted"
    // LKM returns -EAGAIN on success to self-unload
    let status = Command::new("insmod")
        .arg(ko_path)
        .arg(format!("mount_point={}", mnt_point.display()))
        .arg(format!("symaddr={}", sym_addr))
        .stdout(Stdio::null()) 
        .stderr(Stdio::null())
        .status();

    match status {
        Ok(_) => {
            log::info!("Paw Pad (Nuke) LKM injected successfully (silent mode).");
            true
        },
        Err(e) => {
            log::error!("Failed to spawn insmod: {}", e);
            false
        },
    }
}

pub fn try_load(mnt_point: &Path) -> bool {
    // Strategy 1: Try SukiSU/KSU ioctl (Best Stealth, No LKM)
    if let Ok(_) = utils::ksu_nuke_sysfs(mnt_point.to_string_lossy().as_ref()) {
        log::info!("Success: Applied Paw Pad via KernelSU ioctl.");
        return true;
    }

    // Strategy 2: Fallback to LKM (Good Stealth)
    try_lkm_load(mnt_point)
}
