// meta-hybrid_mount/src/core/planner.rs
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use anyhow::Result;
use crate::{conf::config, defs};

#[derive(Debug)]
pub struct OverlayOperation {
    pub target: String,
    pub layers: Vec<PathBuf>,
}

#[derive(Debug, Default)]
pub struct MountPlan {
    pub overlay_ops: Vec<OverlayOperation>,
    pub magic_module_paths: Vec<PathBuf>,
    
    // For state tracking
    pub overlay_module_ids: Vec<String>,
    pub magic_module_ids: Vec<String>,
}

pub fn generate(config: &config::Config, mnt_base: &Path) -> Result<MountPlan> {
    let module_modes = config::load_module_modes();
    let mut active_modules: HashMap<String, PathBuf> = HashMap::new();

    // 1. Scan active modules from storage
    if let Ok(entries) = fs::read_dir(mnt_base) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                // Filter out system directories and self
                if name != "lost+found" && name != "meta-hybrid" {
                    active_modules.insert(name, entry.path());
                }
            }
        }
    }

    // 2. Prepare partitions list
    let mut all_partitions = defs::BUILTIN_PARTITIONS.to_vec();
    let extra_parts: Vec<&str> = config.partitions.iter().map(|s| s.as_str()).collect();
    all_partitions.extend(extra_parts);

    // 3. Group modules by partition (for Overlay) or mark for Magic
    let mut partition_overlay_map: HashMap<String, Vec<PathBuf>> = HashMap::new();
    let mut magic_mount_modules: HashSet<PathBuf> = HashSet::new();
    let mut overlay_ids_set: HashSet<String> = HashSet::new();
    let mut magic_ids_set: HashSet<String> = HashSet::new();

    for (module_id, content_path) in &active_modules {
        let mode = module_modes.get(module_id).map(|s| s.as_str()).unwrap_or("auto");
        
        if mode == "magic" {
            magic_mount_modules.insert(content_path.clone());
            magic_ids_set.insert(module_id.clone());
            log::info!("Planner: Module '{}' assigned to Magic Mount", module_id);
        } else {
            // Auto mode: Check partitions
            let mut participates_in_overlay = false;
            for &part in &all_partitions {
                if content_path.join(part).is_dir() {
                    partition_overlay_map.entry(part.to_string()).or_default().push(content_path.clone());
                    participates_in_overlay = true;
                }
            }
            if participates_in_overlay {
                overlay_ids_set.insert(module_id.clone());
            }
        }
    }

    // 4. Construct the Plan
    let mut plan = MountPlan::default();

    // Overlay Operations
    for (part, modules) in partition_overlay_map {
        plan.overlay_ops.push(OverlayOperation {
            target: format!("/{}", part),
            layers: modules,
        });
    }

    // Magic Mounts
    plan.magic_module_paths = magic_mount_modules.into_iter().collect();
    
    // Tracking IDs
    plan.overlay_module_ids = overlay_ids_set.into_iter().collect();
    plan.magic_module_ids = magic_ids_set.into_iter().collect();
    
    plan.overlay_module_ids.sort();
    plan.magic_module_ids.sort();

    Ok(plan)
}
