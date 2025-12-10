// main.cpp - Main entry point (FIXED)
#include "defs.hpp"
#include "utils.hpp"
#include "conf/config.hpp"
#include "core/inventory.hpp"
#include "core/storage.hpp"
#include "core/sync.hpp"
#include "core/planner.hpp"
#include "core/executor.hpp"
#include "core/modules.hpp"
#include "core/state.hpp"
#include "mount/hymofs.hpp"
#include <iostream>
#include <fstream>
#include <cstdlib>
#include <getopt.h>
#include <sys/mount.h>

namespace fs = std::filesystem;
using namespace hymo;

struct CliOptions {
    std::string config_file;
    std::string command;
    fs::path moduledir;
    fs::path tempdir;
    std::string mountsource;
    bool verbose = false;
    std::vector<std::string> partitions;
    std::string output;
    std::vector<std::string> args;
};

static void print_help() {
    std::cout << "Usage: hymo [OPTIONS] [COMMAND]\n\n";
    std::cout << "Commands:\n";
    std::cout << "  mount           Mount all modules (Default action previously)\n";
    std::cout << "  gen-config      Generate default config file\n";
    std::cout << "  show-config     Show current configuration\n";
    std::cout << "  storage         Show storage status\n";
    std::cout << "  modules         List active modules\n";
    std::cout << "  reload          Reload HymoFS mappings\n";
    std::cout << "  add <mod_id>    Add module rules to HymoFS\n";
    std::cout << "  delete <mod_id> Delete module rules from HymoFS\n\n";
    std::cout << "Options:\n";
    std::cout << "  -c, --config FILE       Config file path\n";
    std::cout << "  -m, --moduledir DIR     Module directory\n";
    std::cout << "  -t, --tempdir DIR       Temporary directory\n";
    std::cout << "  -s, --mountsource NAME  Mount source name\n";
    std::cout << "  -v, --verbose           Verbose logging\n";
    std::cout << "  -p, --partition NAME    Add partition (can be used multiple times)\n";
    std::cout << "  -o, --output FILE       Output file (for gen-config)\n";
    std::cout << "  -h, --help              Show this help\n";
}

static CliOptions parse_args(int argc, char* argv[]) {
    CliOptions opts;
    
    static struct option long_options[] = {
        {"config", required_argument, 0, 'c'},
        {"moduledir", required_argument, 0, 'm'},
        {"tempdir", required_argument, 0, 't'},
        {"mountsource", required_argument, 0, 's'},
        {"verbose", no_argument, 0, 'v'},
        {"partition", required_argument, 0, 'p'},
        {"output", required_argument, 0, 'o'},
        {"help", no_argument, 0, 'h'},
        {0, 0, 0, 0}
    };
    
    int opt;
    int option_index = 0;
    
    while ((opt = getopt_long(argc, argv, "c:m:t:s:vp:o:h", long_options, &option_index)) != -1) {
        switch (opt) {
            case 'c':
                opts.config_file = optarg;
                break;
            case 'm':
                opts.moduledir = optarg;
                break;
            case 't':
                opts.tempdir = optarg;
                break;
            case 's':
                opts.mountsource = optarg;
                break;
            case 'v':
                opts.verbose = true;
                break;
            case 'p':
                opts.partitions.push_back(optarg);
                break;
            case 'o':
                opts.output = optarg;
                break;
            case 'h':
                print_help();
                exit(0);
            default:
                print_help();
                exit(1);
        }
    }
    
    if (optind < argc) {
        opts.command = argv[optind];
        optind++;
        while (optind < argc) {
            opts.args.push_back(argv[optind]);
            optind++;
        }
    }
    
    return opts;
}

static Config load_config(const CliOptions& opts) {
    if (!opts.config_file.empty()) {
        return Config::from_file(opts.config_file);
    }
    
    try {
        return Config::load_default();
    } catch (const std::exception& e) {
        fs::path default_path = fs::path(BASE_DIR) / "config.toml";
        if (fs::exists(default_path)) {
            std::cerr << "Error loading config: " << e.what() << "\n";
        }
        return Config();
    }
}

int main(int argc, char* argv[]) {
    try {
        CliOptions cli = parse_args(argc, argv);
        
        if (cli.command.empty()) {
            print_help();
            return 0;
        }

        // 处理命令
        if (!cli.command.empty()) {
            if (cli.command == "gen-config") {
                std::string output = cli.output.empty() ? "config.toml" : cli.output;
                Config().save_to_file(output);
                std::cout << "Generated config: " << output << "\n";
                return 0;
            } else if (cli.command == "show-config") {
                Config config = load_config(cli);
                std::cout << "{\n";
                std::cout << "  \"moduledir\": \"" << config.moduledir.string() << "\",\n";
                std::cout << "  \"tempdir\": \"" << config.tempdir.string() << "\",\n";
                std::cout << "  \"mountsource\": \"" << config.mountsource << "\",\n";
                std::cout << "  \"verbose\": " << (config.verbose ? "true" : "false") << ",\n";
                std::cout << "  \"force_ext4\": " << (config.force_ext4 ? "true" : "false") << ",\n";
                std::cout << "  \"disable_umount\": " << (config.disable_umount ? "true" : "false") << ",\n";
                std::cout << "  \"enable_nuke\": " << (config.enable_nuke ? "true" : "false") << ",\n";
                std::cout << "  \"ignore_protocol_mismatch\": " << (config.ignore_protocol_mismatch ? "true" : "false") << ",\n";
                std::cout << "  \"hymofs_available\": " << (HymoFS::is_available() ? "true" : "false") << ",\n";
                std::cout << "  \"hymofs_status\": " << (int)HymoFS::check_status() << ",\n";
                std::cout << "  \"partitions\": [";
                for (size_t i = 0; i < config.partitions.size(); ++i) {
                    std::cout << "\"" << config.partitions[i] << "\"";
                    if (i < config.partitions.size() - 1) std::cout << ", ";
                }
                std::cout << "]\n";
                std::cout << "}\n";
                return 0;
            } else if (cli.command == "add") {
                Config config = load_config(cli);
                if (cli.args.empty()) {
                    std::cerr << "Error: Module ID required for add command\n";
                    return 1;
                }
                std::string module_id = cli.args[0];
                fs::path module_path = config.moduledir / module_id;
                
                if (!fs::exists(module_path)) {
                    std::cerr << "Error: Module not found: " << module_id << "\n";
                    return 1;
                }

                std::vector<std::string> all_partitions = BUILTIN_PARTITIONS;
                all_partitions.insert(all_partitions.end(), config.partitions.begin(), config.partitions.end());
                
                // Deduplicate
                std::sort(all_partitions.begin(), all_partitions.end());
                all_partitions.erase(std::unique(all_partitions.begin(), all_partitions.end()), all_partitions.end());

                int success_count = 0;
                for (const auto& part : all_partitions) {
                    fs::path src_dir = module_path / part;
                    if (fs::exists(src_dir) && fs::is_directory(src_dir)) {
                        fs::path target_base = fs::path("/") / part;
                        if (HymoFS::inject_directory(target_base, src_dir)) {
                             if (config.verbose) std::cout << "Injected " << src_dir << " to " << target_base << "\n";
                             success_count++;
                        }
                    }
                }
                
                if (success_count > 0) {
                    std::cout << "Successfully added module " << module_id << "\n";
                    
                    // Update runtime state
                    RuntimeState state = load_runtime_state();
                    bool already_active = false;
                    for (const auto& id : state.hymofs_module_ids) {
                        if (id == module_id) {
                            already_active = true;
                            break;
                        }
                    }
                    if (!already_active) {
                        state.hymofs_module_ids.push_back(module_id);
                        state.save();
                    }
                } else {
                    std::cout << "No content found to add for module " << module_id << "\n";
                }
                return 0;
            } else if (cli.command == "delete") {
                Config config = load_config(cli);
                if (cli.args.empty()) {
                    std::cerr << "Error: Module ID required for delete command\n";
                    return 1;
                }
                std::string module_id = cli.args[0];
                fs::path module_path = config.moduledir / module_id;
                
                std::vector<std::string> all_partitions = BUILTIN_PARTITIONS;
                all_partitions.insert(all_partitions.end(), config.partitions.begin(), config.partitions.end());
                
                // Deduplicate
                std::sort(all_partitions.begin(), all_partitions.end());
                all_partitions.erase(std::unique(all_partitions.begin(), all_partitions.end()), all_partitions.end());

                int success_count = 0;
                for (const auto& part : all_partitions) {
                    fs::path src_dir = module_path / part;
                    if (fs::exists(src_dir) && fs::is_directory(src_dir)) {
                        fs::path target_base = fs::path("/") / part;
                        if (HymoFS::delete_directory_rules(target_base, src_dir)) {
                             if (config.verbose) std::cout << "Deleted rules for " << src_dir << "\n";
                             success_count++;
                        }
                    }
                }
                
                if (success_count > 0) {
                    std::cout << "Successfully removed " << success_count << " rules for module " << module_id << "\n";
                    
                    // Update runtime state
                    RuntimeState state = load_runtime_state();
                    auto it = std::remove(state.hymofs_module_ids.begin(), state.hymofs_module_ids.end(), module_id);
                    if (it != state.hymofs_module_ids.end()) {
                        state.hymofs_module_ids.erase(it, state.hymofs_module_ids.end());
                        state.save();
                    }
                } else {
                    std::cout << "No active rules found or removed for module " << module_id << "\n";
                }
                return 0;
            } else if (cli.command == "storage") {
                print_storage_status();
                return 0;
            } else if (cli.command == "modules") {
                Config config = load_config(cli);
                print_module_list(config);
                return 0;
            } else if (cli.command == "reload") {
                Config config = load_config(cli);
                // Initialize logger for reload command
                Logger::getInstance().init(config.verbose, "");
                
                if (HymoFS::is_available()) {
                    LOG_INFO("Reloading HymoFS mappings...");
                    const fs::path MIRROR_DIR = "/dev/hymo_mirror";
                    
                    // 1. Scan modules
                    auto module_list = scan_modules(config.moduledir, config);
                    
                    // 2. Filter active
                    std::vector<Module> active_modules;
                    std::vector<std::string> all_partitions = BUILTIN_PARTITIONS;
                    for (const auto& part : config.partitions) all_partitions.push_back(part);

                    for (const auto& mod : module_list) {
                        // Check for hot unmount marker
                        if (fs::exists("/data/adb/hymo/run/hot_unmounted/" + mod.id)) {
                            LOG_INFO("Skipping hot-unmounted module: " + mod.id);
                            continue;
                        }

                        bool has_content = false;
                        for (const auto& part : all_partitions) {
                            if (has_files_recursive(mod.source_path / part)) {
                                has_content = true;
                                break;
                            }
                        }
                        if (has_content) active_modules.push_back(mod);
                    }
                    module_list = active_modules;

                    // 3. Sync to mirror
                    LOG_INFO("Syncing modules to mirror...");
                    for (const auto& mod : module_list) {
                        fs::path src = config.moduledir / mod.id;
                        fs::path dst = MIRROR_DIR / mod.id;
                        sync_dir(src, dst);
                    }
                    
                    // 4. Update mappings
                    MountPlan plan = generate_plan(config, module_list, MIRROR_DIR);
                    update_hymofs_mappings(config, module_list, MIRROR_DIR, plan);
                    
                    // 5. Update Runtime State (daemon_state.json)
                    RuntimeState state = load_runtime_state();
                    
                    if (state.storage_mode.empty()) {
                        state.storage_mode = "hymofs";
                    }
                    state.mount_point = MIRROR_DIR.string();
                    state.hymofs_module_ids = plan.hymofs_module_ids;
                    
                    // Recalculate active mounts for HymoFS
                    state.active_mounts.clear();
                    std::vector<std::string> all_parts = BUILTIN_PARTITIONS;
                    for(const auto& p : config.partitions) all_parts.push_back(p);
                    
                    for (const auto& part : all_parts) {
                        bool active = false;
                        for (const auto& mod_id : plan.hymofs_module_ids) {
                            for (const auto& m : module_list) {
                                if (m.id == mod_id) {
                                    if (fs::exists(m.source_path / part)) {
                                        active = true;
                                        break;
                                    }
                                }
                            }
                            if (active) break;
                        }
                        if (active) state.active_mounts.push_back(part);
                    }
                    
                    state.save();

                    LOG_INFO("Reload complete.");
                } else {
                    LOG_WARN("HymoFS not available, cannot hot reload.");
                }
                return 0;
            } else if (cli.command != "mount") {
                std::cerr << "Unknown command: " << cli.command << "\n";
                print_help();
                return 1;
            }
        }
        
        // 加载并合并配置
        Config config = load_config(cli);
        config.merge_with_cli(cli.moduledir, cli.tempdir, cli.mountsource, cli.verbose, cli.partitions);
        
        // 初始化日志
        // Logger::getInstance().init(config.verbose, DAEMON_LOG_FILE);
        Logger::getInstance().init(config.verbose, ""); // Disable internal file logging, rely on stdout redirection
        
        // 伪装进程
        if (!camouflage_process("kworker/u9:1")) {
            LOG_WARN("Failed to camouflage process");
        }
        
        LOG_INFO("Hymo Daemon Starting...");
        
        if (config.disable_umount) {
            LOG_WARN("Namespace Detach (try_umount) is DISABLED.");
        }
        
        // 确保运行目录存在
        ensure_dir_exists(RUN_DIR);

        StorageHandle storage;
        MountPlan plan;
        ExecutionResult exec_result;
        std::vector<Module> module_list;
        
        HymoFSStatus hymofs_status = HymoFS::check_status();
        std::string warning_msg = "";

        bool can_use_hymofs = (hymofs_status == HymoFSStatus::Available);
        
        if (!can_use_hymofs && config.ignore_protocol_mismatch) {
            if (hymofs_status == HymoFSStatus::KernelTooOld || hymofs_status == HymoFSStatus::ModuleTooOld) {
                LOG_WARN("Forcing HymoFS despite protocol mismatch (ignore_protocol_mismatch=true)");
                can_use_hymofs = true;
                if (hymofs_status == HymoFSStatus::KernelTooOld) {
                    warning_msg = "⚠️Kernel version is lower than module version. Please update your kernel.";
                } else if (hymofs_status == HymoFSStatus::ModuleTooOld) {
                    warning_msg = "⚠️Module version is lower than kernel version. Please update your module.";
                }
            } else {
                LOG_WARN("Cannot force HymoFS: Kernel module not present or error state (Status: " + std::to_string((int)hymofs_status) + ")");
            }
        }

        if (can_use_hymofs) {
             // **HymoFS Fast Path**
            LOG_INFO("Mode: HymoFS Fast Path");
            
            // **Mirror Strategy (Tmpfs/Ext4)**
            // To avoid SELinux/permission issues on /data, we mirror active modules to a tmpfs or ext4 image
            // and inject from there.
            const fs::path MIRROR_DIR = "/dev/hymo_mirror";
            fs::path img_path = fs::path(BASE_DIR) / "modules.img";
            bool mirror_success = false;
            
            try {
                // Reuse setup_storage to handle Tmpfs -> Ext4 fallback
                // We pass config.force_ext4 to respect user setting
                try {
                    storage = setup_storage(MIRROR_DIR, img_path, config.force_ext4);
                } catch (const std::exception& e) {
                    if (config.force_ext4) {
                        LOG_WARN("Force Ext4 failed: " + std::string(e.what()) + ". Falling back to auto (Tmpfs/Ext4).");
                        storage = setup_storage(MIRROR_DIR, img_path, false);
                    } else {
                        throw;
                    }
                }
                LOG_INFO("Mirror storage setup successful. Mode: " + storage.mode);

                // Scan modules from source to know what to copy
                module_list = scan_modules(config.moduledir, config);
                
                // Filter modules: only copy if they have content for target partitions
                std::vector<Module> active_modules;
                std::vector<std::string> all_partitions = BUILTIN_PARTITIONS;
                for (const auto& part : config.partitions) all_partitions.push_back(part);

                for (const auto& mod : module_list) {
                    bool has_content = false;
                    for (const auto& part : all_partitions) {
                        if (has_files_recursive(mod.source_path / part)) {
                            has_content = true;
                            break;
                        }
                    }
                    if (has_content) {
                        active_modules.push_back(mod);
                    } else {
                        LOG_DEBUG("Skipping empty/irrelevant module for mirror: " + mod.id);
                    }
                }
                
                // Update module_list to only include active ones for subsequent steps
                module_list = active_modules;

                LOG_INFO("Syncing " + std::to_string(module_list.size()) + " active modules to mirror...");
                
                bool sync_ok = true;
                for (const auto& mod : module_list) {
                    fs::path src = config.moduledir / mod.id;
                    fs::path dst = MIRROR_DIR / mod.id;
                    if (!sync_dir(src, dst)) {
                        LOG_ERROR("Failed to sync module: " + mod.id);
                        sync_ok = false;
                    }
                }
                
                if (sync_ok) {
                    // If using ext4 image, we need to fix permissions after sync
                    if (storage.mode == "ext4") {
                        finalize_storage_permissions(storage.mount_point);
                    }

                    mirror_success = true;
                    storage.mode = "hymofs";
                    storage.mount_point = MIRROR_DIR;
                    
                    // Generate plan from MIRROR
                    plan = generate_plan(config, module_list, MIRROR_DIR);
                    
                    // Update Kernel Mappings using MIRROR paths
                    update_hymofs_mappings(config, module_list, MIRROR_DIR, plan);
                    
                    // Execute plan
                    exec_result = execute_plan(plan, config);
                } else {
                    LOG_ERROR("Mirror sync failed. Aborting mirror strategy.");
                    umount(MIRROR_DIR.c_str());
                }

            } catch (const std::exception& e) {
                LOG_ERROR("Failed to setup mirror storage: " + std::string(e.what()));
            }
            
            if (!mirror_success) {
                LOG_WARN("Mirror setup failed. Falling back to Magic Mount (skipping Legacy HymoFS to avoid SELinux issues).");
                
                // Fallback to Magic Mount using source directory directly
                storage.mode = "magic_only";
                storage.mount_point = config.moduledir;
                
                module_list = scan_modules(config.moduledir, config);
                
                // Manually construct a Magic Mount plan
                plan.overlay_ops.clear();
                plan.hymofs_module_ids.clear();
                plan.magic_module_paths.clear();
                
                for (const auto& mod : module_list) {
                    // Check if module has content
                    bool has_content = false;
                    std::vector<std::string> all_partitions = BUILTIN_PARTITIONS;
                    for (const auto& part : config.partitions) all_partitions.push_back(part);
                    
                    for (const auto& part : all_partitions) {
                        if (has_files_recursive(mod.source_path / part)) {
                            has_content = true;
                            break;
                        }
                    }
                    
                    if (has_content) {
                        plan.magic_module_paths.push_back(mod.source_path);
                        exec_result.magic_module_ids.push_back(mod.id);
                    }
                }
                
                // Execute plan
                exec_result = execute_plan(plan, config);
            }
            
        } else {
            // **Legacy/Overlay Path**
            if (hymofs_status == HymoFSStatus::KernelTooOld) {
                LOG_WARN("HymoFS Protocol Mismatch! Kernel is too old.");
                warning_msg = "⚠️Kernel version is lower than module version. Please update your kernel.";
            } else if (hymofs_status == HymoFSStatus::ModuleTooOld) {
                LOG_WARN("HymoFS Protocol Mismatch! Module is too old.");
                warning_msg = "⚠️Module version is lower than kernel version. Please update your module.";
            }

            LOG_INFO("Mode: Standard Overlay/Magic (Copy)");
            
            // **步骤 1: 设置存储**
            fs::path mnt_base(FALLBACK_CONTENT_DIR);
            fs::path img_path = fs::path(BASE_DIR) / "modules.img";
            
            storage = setup_storage(mnt_base, img_path, config.force_ext4);
            
            // **步骤 2: 扫描模块**
            module_list = scan_modules(config.moduledir, config);
            LOG_INFO("Scanned " + std::to_string(module_list.size()) + " active modules.");
            
            // **步骤 3: 同步模块内容**
            perform_sync(module_list, storage.mount_point, config);
            
            // **FIX 1: 在同步完成后修复存储根权限**
            if (storage.mode == "ext4") {
                finalize_storage_permissions(storage.mount_point);
            }
            
            // **步骤 4: 生成挂载计划**
            LOG_INFO("Generating mount plan...");
            plan = generate_plan(config, module_list, storage.mount_point);
            
            // **步骤 5: 执行计划**
            exec_result = execute_plan(plan, config);
        }
        
        LOG_INFO("Plan: " + std::to_string(exec_result.overlay_module_ids.size()) + " OverlayFS modules, " +
                 std::to_string(exec_result.magic_module_ids.size()) + " Magic modules, " +
                 std::to_string(plan.hymofs_module_ids.size()) + " HymoFS modules");
        
        // **步骤 6: KSU Nuke (隐蔽)**
        bool nuke_active = false;
        if (storage.mode == "ext4" && config.enable_nuke) {
            LOG_INFO("Attempting to deploy Paw Pad (Stealth) via KernelSU...");
            if (ksu_nuke_sysfs(storage.mount_point.string())) {
                LOG_INFO("Success: Paw Pad active. Ext4 sysfs traces nuked.");
                nuke_active = true;
            } else {
                LOG_WARN("Paw Pad failed (KSU ioctl error)");
            }
        }
        
        // **步骤 8: 保存运行时状态**
        RuntimeState state;
        state.storage_mode = storage.mode;
        state.mount_point = storage.mount_point.string();
        state.overlay_module_ids = exec_result.overlay_module_ids;
        state.magic_module_ids = exec_result.magic_module_ids;
        state.hymofs_module_ids = plan.hymofs_module_ids;
        state.nuke_active = nuke_active;
        
        // Populate active mounts
        if (!plan.hymofs_module_ids.empty()) {
            // If HymoFS is active, we assume it covers all target partitions that have content
            // This is a simplification, but HymoFS usually mounts a global overlay or intercepts all
            // We can iterate over partitions and check if any HymoFS module has content for them
            // But for now, let's just list all partitions that are targeted by HymoFS modules
            // Actually, HymoFS logic in planner doesn't explicitly list partitions like overlay_ops does.
            // We can infer it from the module content.
            std::vector<std::string> all_parts = BUILTIN_PARTITIONS;
            for(const auto& p : config.partitions) all_parts.push_back(p);
            
            for (const auto& part : all_parts) {
                bool active = false;
                // Check if any HymoFS module has this partition
                for (const auto& mod_id : plan.hymofs_module_ids) {
                    // Find module by ID (inefficient but works)
                    for (const auto& m : module_list) {
                        if (m.id == mod_id) {
                            if (fs::exists(m.source_path / part)) {
                                active = true;
                                break;
                            }
                        }
                    }
                    if (active) break;
                }
                if (active) state.active_mounts.push_back(part);
            }
        }
        
        // Also add OverlayFS targets
        for (const auto& op : plan.overlay_ops) {
            // op.target is like "/system"
            fs::path p(op.target);
            std::string name = p.filename().string();
            // Avoid duplicates
            bool exists = false;
            for(const auto& existing : state.active_mounts) {
                if(existing == name) { exists = true; break; }
            }
            if(!exists) state.active_mounts.push_back(name);
        }

        // Also add Magic Mount targets
        // Magic mount usually targets /system, /vendor etc.
        // We can infer from magic_module_paths or just check if magic is active
        if (!plan.magic_module_paths.empty()) {
             // Magic mount logic in magic.cpp usually mounts on /system, /vendor, etc.
             // It's harder to know exactly which ones without parsing the tree.
             // But we can check if modules have content for them.
             std::vector<std::string> all_parts = BUILTIN_PARTITIONS;
             for(const auto& p : config.partitions) all_parts.push_back(p);

             for (const auto& part : all_parts) {
                bool active = false;
                // Check if any Magic module has this partition
                for (const auto& mod_id : plan.magic_module_ids) {
                    for (const auto& m : module_list) {
                        if (m.id == mod_id) {
                            if (fs::exists(m.source_path / part)) {
                                active = true;
                                break;
                            }
                        }
                    }
                    if (active) break;
                }
                
                // Avoid duplicates
                bool exists = false;
                for(const auto& existing : state.active_mounts) {
                    if(existing == part) { exists = true; break; }
                }
                if (active && !exists) state.active_mounts.push_back(part);
            }
        }
        
        // Update mismatch state
        if (hymofs_status == HymoFSStatus::KernelTooOld || hymofs_status == HymoFSStatus::ModuleTooOld) {
            state.hymofs_mismatch = true;
            state.mismatch_message = warning_msg;
        } else if (config.ignore_protocol_mismatch && !warning_msg.empty()) {
             // Even if we forced it, we still want to show the warning in WebUI if there was a mismatch
             state.hymofs_mismatch = true;
             state.mismatch_message = warning_msg;
        }

        if (!state.save()) {
            LOG_ERROR("Failed to save runtime state");
        }
        
        // Update module description
        update_module_description(
            true, 
            storage.mode, 
            nuke_active, 
            exec_result.overlay_module_ids.size(),
            exec_result.magic_module_ids.size(),
            plan.hymofs_module_ids.size(),
            warning_msg
        );
        
        LOG_INFO("Hymo Completed.");
        
    } catch (const std::exception& e) {
        std::cerr << "Fatal Error: " << e.what() << "\n";
        LOG_ERROR("Fatal Error: " + std::string(e.what()));
        // 使用失败 emoji 更新
        update_module_description(false, "error", false, 0, 0, 0);
        return 1;
    }
    
    return 0;
}