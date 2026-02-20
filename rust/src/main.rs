//! hymod - HymoFS Rust daemon
//!
//! Commands: status | clear | mount | lkm load|unload|status | set-uname <release> <version>

use hymo_minimal::{HymoFS, HymoFSStatus};
use std::env;
use std::path::Path;
use std::process::Command;

const LKM_KO: &str = "/data/adb/modules/hymo/hymofs_lkm.ko";
const LKM_AUTOLOAD: &str = "/data/adb/hymo/lkm_autoload";
const HYMO_SYSCALL_NR: i32 = 142;

fn main() {
    let args: Vec<String> = env::args().collect();
    let cmd = args.get(1).map(|s| s.as_str()).unwrap_or("status");

    match cmd {
        "status" => cmd_status(),
        "clear" => cmd_clear(),
        "mount" => cmd_mount(),
        "lkm" => {
            let sub = args.get(2).map(|s| s.as_str()).unwrap_or("status");
            match sub {
                "load" => cmd_lkm_load(),
                "unload" => cmd_lkm_unload(),
                "status" => cmd_lkm_status(),
                "autoload" => {
                    let on = args.get(3).map(|s| s.as_str()).unwrap_or("status");
                    cmd_lkm_autoload(on);
                }
                _ => {
                    eprintln!("Usage: hymod lkm <load|unload|status|autoload on|off>");
                    std::process::exit(1);
                }
            }
        }
        "set-uname" => {
            let release = args.get(2).map(|s| s.as_str()).unwrap_or("");
            let version = args.get(3).map(|s| s.as_str()).unwrap_or("");
            cmd_set_uname(release, version);
        }
        _ => {
            eprintln!("Usage: hymod <status|clear|mount|lkm|set-uname>");
            eprintln!("  lkm load|unload|status|autoload on|off");
            eprintln!("  set-uname <release> <version>");
            std::process::exit(1);
        }
    }
}

fn cmd_status() {
    let status = HymoFS::check_status();
    let msg = match status {
        HymoFSStatus::Available => "HymoFS available",
        HymoFSStatus::NotPresent => "HymoFS LKM not present",
        HymoFSStatus::KernelTooOld => "Kernel version too old",
        HymoFSStatus::ModuleTooOld => "Module version too old",
    };
    println!("{}", msg);

    if status == HymoFSStatus::Available {
        if let Ok(v) = HymoFS::get_protocol_version() {
            println!("Protocol version: {}", v);
        }
    }
}

fn cmd_clear() {
    if !HymoFS::is_available() {
        eprintln!("HymoFS not available");
        std::process::exit(1);
    }
    match HymoFS::clear_rules() {
        Ok(()) => println!("Rules cleared"),
        Err(e) => {
            eprintln!("Failed: {}", e);
            std::process::exit(1);
        }
    }
}

fn cmd_mount() {
    if !HymoFS::is_available() {
        eprintln!("HymoFS not available");
        std::process::exit(1);
    }

    let moduledir = Path::new("/data/adb/modules");
    if !moduledir.exists() {
        eprintln!("Module dir not found: {:?}", moduledir);
        std::process::exit(1);
    }

    // Use moduledir as mirror source (direct path, no sync)
    let mirror = moduledir.to_string_lossy();
    if let Err(e) = HymoFS::set_mirror_path(&mirror) {
        eprintln!("set_mirror_path failed: {}", e);
        std::process::exit(1);
    }

    if let Err(e) = HymoFS::clear_rules() {
        eprintln!("clear_rules failed: {}", e);
        std::process::exit(1);
    }

    // Minimal: add rules for each module with system/vendor etc
    let partitions = ["system", "vendor", "product", "system_ext", "odm", "oem"];
    let mut count = 0u32;

    if let Ok(entries) = std::fs::read_dir(moduledir) {
        let mut modules: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .filter(|e| {
                let name = e.file_name();
                let n = name.to_string_lossy();
                n != "hymo" && n != "lost+found" && n != ".git"
            })
            .filter(|e| {
                !e.path().join("disable").exists()
                    && !e.path().join("remove").exists()
                    && !e.path().join("skip_mount").exists()
            })
            .collect();
        modules.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

        for entry in modules {
            let mod_path = entry.path();
            for part in &partitions {
                let part_path = mod_path.join(part);
                if part_path.exists() && part_path.is_dir() {
                    if has_files(&part_path) {
                        let target = format!("/{}", part);
                        let source = part_path.to_string_lossy();
                        if HymoFS::add_merge_rule(&source, &target).is_ok() {
                            count += 1;
                        }
                    }
                }
            }
        }
    }

    if let Err(e) = HymoFS::set_enabled(true) {
        eprintln!("set_enabled failed: {}", e);
        std::process::exit(1);
    }

    println!("Mounted {} rules", count);
}

fn has_files(path: &Path) -> bool {
    std::fs::read_dir(path)
        .map(|mut d| d.next().is_some())
        .unwrap_or(false)
}

// === LKM ===
fn cmd_lkm_status() {
    if HymoFS::is_available() {
        println!("LKM loaded");
    } else {
        println!("LKM not loaded");
    }
}

fn cmd_lkm_load() {
    if !Path::new(LKM_KO).exists() {
        eprintln!("LKM not found: {}", LKM_KO);
        std::process::exit(1);
    }
    let status = Command::new("insmod")
        .arg(LKM_KO)
        .arg(format!("hymo_syscall_nr={}", HYMO_SYSCALL_NR))
        .output();
    match status {
        Ok(o) if o.status.success() => println!("LKM loaded"),
        Ok(o) => {
            eprintln!("insmod failed: {}", String::from_utf8_lossy(&o.stderr));
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("insmod: {}", e);
            std::process::exit(1);
        }
    }
}

fn cmd_lkm_unload() {
    if HymoFS::is_available() {
        let _ = HymoFS::clear_rules();
    }
    let status = Command::new("rmmod").arg("hymofs_lkm").output();
    match status {
        Ok(o) if o.status.success() => println!("LKM unloaded"),
        Ok(o) => {
            eprintln!("rmmod failed: {}", String::from_utf8_lossy(&o.stderr));
            std::process::exit(1);
        }
        Err(e) => {
            eprintln!("rmmod: {}", e);
            std::process::exit(1);
        }
    }
}

fn cmd_lkm_autoload(arg: &str) {
    let ensure_dir = || {
        let dir = Path::new(LKM_AUTOLOAD).parent().unwrap_or(Path::new("/"));
        std::fs::create_dir_all(dir)
    };
    match arg {
        "on" | "1" => {
            let _ = ensure_dir();
            if let Err(e) = std::fs::write(LKM_AUTOLOAD, "1") {
                eprintln!("Failed to write {}: {}", LKM_AUTOLOAD, e);
                std::process::exit(1);
            }
            println!("LKM autoload: on");
        }
        "off" | "0" => {
            let _ = ensure_dir();
            if let Err(e) = std::fs::write(LKM_AUTOLOAD, "0") {
                eprintln!("Failed to write {}: {}", LKM_AUTOLOAD, e);
                std::process::exit(1);
            }
            println!("LKM autoload: off");
        }
        "status" | _ => {
            let v = std::fs::read_to_string(LKM_AUTOLOAD).unwrap_or_default();
            let on = v.trim() == "1" || v.trim() == "on" || v.trim() == "true" || v.is_empty();
            println!("LKM autoload: {}", if on { "on" } else { "off" });
        }
    }
}

// === uname 伪装 ===
fn cmd_set_uname(release: &str, version: &str) {
    if release.is_empty() || version.is_empty() {
        eprintln!("Usage: hymod set-uname <release> <version>");
        eprintln!("  e.g. hymod set-uname 5.10.0 5.10.0-android12");
        std::process::exit(1);
    }
    if !HymoFS::is_available() {
        eprintln!("HymoFS not available");
        std::process::exit(1);
    }
    match HymoFS::set_uname(release, version) {
        Ok(()) => println!("uname spoof: {} {}", release, version),
        Err(e) => {
            eprintln!("set_uname failed: {}", e);
            std::process::exit(1);
        }
    }
}
