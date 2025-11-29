// meta-hybrid_mount/src/storage.rs
use std::fs;
use std::path::{Path, PathBuf};
use anyhow::{Context, Result};
use rustix::mount::{unmount, UnmountFlags};
use crate::{defs, utils};

pub fn setup(mnt_dir: &Path, image_path: &Path, force_ext4: bool) -> Result<String> {
    log::info!("Setting up storage at {}", mnt_dir.display());

    if force_ext4 {
        log::info!("Force Ext4 enabled. Skipping Tmpfs check.");
    } else {
        log::info!("Attempting Tmpfs mode...");
        if let Err(e) = utils::mount_tmpfs(mnt_dir) {
            log::warn!("Tmpfs mount failed: {}. Falling back to Image.", e);
        } else {
            if utils::is_xattr_supported(mnt_dir) {
                log::info!("Tmpfs mode active (XATTR supported).");
                return Ok("tmpfs".to_string());
            } else {
                log::warn!("Tmpfs does NOT support XATTR. Unmounting...");
                let _ = unmount(mnt_dir, UnmountFlags::DETACH);
            }
        }
    }

    log::info!("Falling back to Ext4 Image mode...");
    if !image_path.exists() {
        anyhow::bail!("modules.img not found at {}", image_path.display());
    }
    
    utils::mount_image(image_path, mnt_dir)
        .context("Failed to mount modules.img")?;
        
    log::info!("Image mode active.");
    Ok("ext4".to_string())
}

fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;
    if bytes >= GB { format!("{:.1}G", bytes as f64 / GB as f64) }
    else if bytes >= MB { format!("{:.0}M", bytes as f64 / MB as f64) }
    else if bytes >= KB { format!("{:.0}K", bytes as f64 / KB as f64) }
    else { format!("{}B", bytes) }
}

pub fn print_status() -> Result<()> {
    let mut path = PathBuf::from(defs::FALLBACK_CONTENT_DIR);
    if let Ok(state) = fs::read_to_string(defs::MOUNT_POINT_FILE) {
        let trimmed = state.trim();
        if !trimmed.is_empty() { path = PathBuf::from(trimmed); }
    }
    
    if !path.exists() {
        println!("{{ \"error\": \"Not mounted\" }}");
        return Ok(());
    }

    // Direct read from state file - The Single Source of Truth
    let fs_type = fs::read_to_string(defs::STORAGE_MODE_FILE)
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|_| "unknown".to_string());

    let stats = rustix::fs::statvfs(&path).context("statvfs failed")?;
    let block_size = stats.f_frsize as u64;
    let total_bytes = stats.f_blocks as u64 * block_size;
    let free_bytes = stats.f_bfree as u64 * block_size;
    let used_bytes = total_bytes.saturating_sub(free_bytes);
    let percent = if total_bytes > 0 { (used_bytes as f64 / total_bytes as f64) * 100.0 } else { 0.0 };
    
    println!(
        "{{ \"size\": \"{}\", \"used\": \"{}\", \"percent\": \"{:.0}%\", \"type\": \"{}\" }}",
        format_size(total_bytes),
        format_size(used_bytes),
        percent,
        fs_type
    );
    Ok(())
}
