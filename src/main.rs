// src/main.rs
mod conf;
mod core;
mod defs;
mod mount;
mod utils;

use std::path::{Path, PathBuf};
use anyhow::Result;
use clap::Parser;
use mimalloc::MiMalloc;

use conf::{
    cli::{Cli, Commands},
    config::{Config, CONFIG_FILE_DEFAULT},
};
use core::{
    executor,
    inventory,
    planner,
    state::RuntimeState,
    storage,
    sync,
    modules, // Keep for legacy update_description or helper functions if needed
};
use mount::nuke;

#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;

fn load_config(cli: &Cli) -> Result<Config> {
    if let Some(config_path) = &cli.config {
        return Config::from_file(config_path);
    }
    match Config::load_default() {
        Ok(config) => Ok(config),
        Err(e) => {
            if Path::new(CONFIG_FILE_DEFAULT).exists() {
                eprintln!("Error loading config: {:#}", e);
            }
            Ok(Config::default())
        }
    }
}

fn run() -> Result<()> {
    let cli = Cli::parse();

    // Handle Subcommands
    if let Some(command) = &cli.command {
        match command {
            Commands::GenConfig { output } => { 
                Config::default().save_to_file(output)?; 
                return Ok(()); 
            },
            Commands::ShowConfig => { 
                let config = load_config(&cli)?;
                println!("{}", serde_json::to_string(&config)?); 
                return Ok(()); 
            },
            Commands::Storage => { 
                storage::print_status()?; 
                return Ok(()); 
            },
            Commands::Modules => { 
                let config = load_config(&cli)?;
                modules::print_list(&config)?; 
                return Ok(()); 
            }
        }
    }

    // Initialize Daemon Logic
    let mut config = load_config(&cli)?;
    config.merge_with_cli(
        cli.moduledir.clone(), 
        cli.tempdir.clone(), 
        cli.mountsource.clone(), 
        cli.verbose, 
        cli.partitions.clone()
    );

    utils::init_logger(config.verbose, Path::new(defs::DAEMON_LOG_FILE))?;

    // Stealth: Camouflage process
    if let Err(e) = utils::camouflage_process("kworker/u9:1") {
        log::warn!("Failed to camouflage process: {}", e);
    }

    log::info!("Meta-Hybrid Mount Starting (Refactored Core)...");

    if config.disable_umount {
        log::warn!("Namespace Detach (try_umount) is DISABLED.");
    }

    utils::ensure_dir_exists(defs::RUN_DIR)?;

    // 1. Prepare Storage Infrastructure
    let mnt_base = PathBuf::from(defs::FALLBACK_CONTENT_DIR);
    let img_path = Path::new(defs::BASE_DIR).join("modules.img");
    
    // setup returns a handle with storage type and root path
    let storage_handle = storage::setup(&mnt_base, &img_path, config.force_ext4)?;

    // 2. Inventory Scan (Read-Only)
    let module_list = inventory::scan(&config.moduledir, &config)?;
    log::info!("Scanned {} active modules.", module_list.len());

    // 3. Synchronization (Write)
    // This will sync files and fix permissions/contexts
    sync::perform_sync(&module_list, &storage_handle.mount_point)?;

    // 4. Planning (Logic)
    log::info!("Generating mount plan...");
    let plan = planner::generate(&config, &module_list, &storage_handle.mount_point)?;
    
    log::info!("Plan: {} OverlayFS ops, {} Magic modules", 
        plan.overlay_ops.len(), 
        plan.magic_module_paths.len()
    );

    // 5. Execution
    let exec_result = executor::execute(&plan, &config)?;

    // 6. Post-Mount Stealth & State
    let mut nuke_active = false;
    if storage_handle.mode == "ext4" && config.enable_nuke {
        nuke_active = nuke::try_load(&storage_handle.mount_point);
    }

    modules::update_description(
        &storage_handle.mode, 
        nuke_active, 
        exec_result.overlay_module_ids.len(), 
        exec_result.magic_module_ids.len()
    );

    let state = RuntimeState::new(
        storage_handle.mode,
        storage_handle.mount_point,
        exec_result.overlay_module_ids,
        exec_result.magic_module_ids,
        nuke_active
    );
    
    if let Err(e) = state.save() {
        log::error!("Failed to save runtime state: {}", e);
    }

    log::info!("Meta-Hybrid Mount Completed.");
    Ok(())
}

fn main() {
    if let Err(e) = run() {
        log::error!("Fatal Error: {:#}", e);
        eprintln!("Fatal Error: {:#}", e);
        std::process::exit(1);
    }
}
