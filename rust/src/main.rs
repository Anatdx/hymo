//! hymod - HymoFS Rust daemon
//!
//! Minimal daemon using hymo-minimal library.
//! Commands: status | clear | mount

use hymo_minimal::{HymoFS, HymoFSStatus};
use std::env;
use std::path::Path;

fn main() {
    let args: Vec<String> = env::args().collect();
    let cmd = args.get(1).map(|s| s.as_str()).unwrap_or("status");

    match cmd {
        "status" => cmd_status(),
        "clear" => cmd_clear(),
        "mount" => cmd_mount(),
        _ => {
            eprintln!("Usage: hymod <status|clear|mount>");
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
