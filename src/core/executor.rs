// meta-hybrid_mount/src/core/executor.rs
use std::path::Path;
use anyhow::Result;
// Adjusted imports
use crate::{
    conf::config, 
    mount::{magic, overlay}, 
    utils,
    core::planner::MountPlan
};

pub struct ExecutionResult {
    pub overlay_module_ids: Vec<String>,
    pub magic_module_ids: Vec<String>,
}

fn extract_id(path: &Path) -> Option<String> {
    path.file_name()
        .map(|s| s.to_string_lossy().to_string())
}

pub fn execute(plan: &MountPlan, config: &config::Config) -> Result<ExecutionResult> {
    let mut magic_queue = plan.magic_module_paths.clone();
    
    // Tracking final effective modules
    let mut final_overlay_ids = plan.overlay_module_ids.clone();
    let mut fallback_ids = Vec::new();

    // Phase A: OverlayFS
    for op in &plan.overlay_ops {
        let layer_paths: Vec<String> = op.layers.iter()
            .map(|p| p.display().to_string())
            .collect();
            
        log::info!("Mounting {} [OVERLAY] ({} layers)", op.target, layer_paths.len());
        
        if let Err(e) = overlay::mount_overlay(&op.target, &layer_paths, None, None, config.disable_umount) {
            log::warn!("OverlayFS mount failed for {}: {}. Fallback to Magic Mount.", op.target, e);
            
            // Fallback Logic: Move these modules to magic queue
            for module_path in &op.layers {
                magic_queue.push(module_path.clone());
                if let Some(id) = extract_id(module_path) {
                    fallback_ids.push(id);
                }
            }
        }
    }

    // Update ID lists based on fallback results
    if !fallback_ids.is_empty() {
        // Remove fallback IDs from overlay list
        final_overlay_ids.retain(|id| !fallback_ids.contains(id));
        // We will reconstruct the magic list accurately from the queue below
    }

    // Phase B: Magic Mount
    let mut final_magic_ids = Vec::new();
    
    if !magic_queue.is_empty() {
        let tempdir = if let Some(t) = &config.tempdir { 
            t.clone() 
        } else { 
            utils::select_temp_dir()? 
        };
        
        // Deduplicate magic queue (in case multiple partitions fell back for the same module)
        magic_queue.sort();
        magic_queue.dedup();

        // Collect IDs for the final report
        for path in &magic_queue {
            if let Some(id) = extract_id(path) {
                final_magic_ids.push(id);
            }
        }
        
        log::info!("Starting Magic Mount Engine for {} modules...", magic_queue.len());
        
        utils::ensure_temp_dir(&tempdir)?;
        
        if let Err(e) = magic::mount_partitions(
            &tempdir, 
            &magic_queue, 
            &config.mountsource, 
            &config.partitions, 
            config.disable_umount
        ) {
            log::error!("Magic Mount failed: {:#}", e);
            // If magic mount fails, these modules effectively failed to mount.
            // We clear the list to reflect reality in the status file.
            final_magic_ids.clear();
        }
        
        utils::cleanup_temp_dir(&tempdir);
    }

    final_overlay_ids.sort();
    final_overlay_ids.dedup();
    final_magic_ids.sort();
    final_magic_ids.dedup();

    Ok(ExecutionResult {
        overlay_module_ids: final_overlay_ids,
        magic_module_ids: final_magic_ids,
    })
}
