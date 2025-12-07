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
};

static void print_help() {
    std::cout << "Usage: hymo [OPTIONS] [COMMAND]\n\n";
    std::cout << "Commands:\n";
    std::cout << "  gen-config      Generate default config file\n";
    std::cout << "  show-config     Show current configuration\n";
    std::cout << "  storage         Show storage status\n";
    std::cout << "  modules         List active modules\n\n";
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
                std::cout << "  \"partitions\": [";
                for (size_t i = 0; i < config.partitions.size(); ++i) {
                    std::cout << "\"" << config.partitions[i] << "\"";
                    if (i < config.partitions.size() - 1) std::cout << ", ";
                }
                std::cout << "]\n";
                std::cout << "}\n";
                return 0;
            } else if (cli.command == "storage") {
                print_storage_status();
                return 0;
            } else if (cli.command == "modules") {
                Config config = load_config(cli);
                print_module_list(config);
                return 0;
            } else {
                std::cerr << "Unknown command: " << cli.command << "\n";
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
        
        if (HymoFS::is_available()) {
             // **HymoFS Fast Path**
            LOG_INFO("Mode: HymoFS Fast Path (Tmpfs Mirror)");
            
            // **Tmpfs Mirror Strategy**
            // To avoid SELinux/permission issues on /data, we mirror active modules to a tmpfs
            // and inject from there.
            const fs::path MIRROR_DIR = "/dev/hymo_mirror";
            bool mirror_success = false;
            
            if (mount_tmpfs(MIRROR_DIR)) {
                LOG_INFO("Mounted tmpfs mirror at " + MIRROR_DIR.string());
                
                // Scan modules from source to know what to copy
                auto source_modules = scan_modules(config.moduledir, config);
                LOG_INFO("Syncing " + std::to_string(source_modules.size()) + " modules to mirror...");
                
                bool sync_ok = true;
                for (const auto& mod : source_modules) {
                    fs::path src = config.moduledir / mod.id;
                    fs::path dst = MIRROR_DIR / mod.id;
                    if (!sync_dir(src, dst)) {
                        LOG_ERROR("Failed to sync module: " + mod.id);
                        sync_ok = false;
                    }
                }
                
                if (sync_ok) {
                    mirror_success = true;
                    storage.mode = "hymofs_mirror";
                    storage.mount_point = MIRROR_DIR;
                    
                    // Generate plan from MIRROR
                    plan = generate_plan(config, source_modules, MIRROR_DIR);
                    
                    // Update Kernel Mappings using MIRROR paths
                    update_hymofs_mappings(config, source_modules, MIRROR_DIR, plan);
                    
                    // Execute plan
                    exec_result = execute_plan(plan, config);
                } else {
                    LOG_ERROR("Mirror sync failed. Aborting mirror strategy.");
                    umount(MIRROR_DIR.c_str());
                }
            } else {
                LOG_ERROR("Failed to mount mirror tmpfs.");
            }
            
            if (!mirror_success) {
                LOG_WARN("Falling back to direct /data injection (Legacy HymoFS)");
                storage.mode = "hymofs_direct";
                storage.mount_point = config.moduledir;
                
                auto module_list = scan_modules(config.moduledir, config);
                plan = generate_plan(config, module_list, config.moduledir);
                update_hymofs_mappings(config, module_list, config.moduledir, plan);
                exec_result = execute_plan(plan, config);
            }
            
        } else {
            // **Legacy/Overlay Path**
            LOG_INFO("Mode: Standard Overlay/Magic (Copy)");
            
            // **步骤 1: 设置存储**
            fs::path mnt_base(FALLBACK_CONTENT_DIR);
            fs::path img_path = fs::path(BASE_DIR) / "modules.img";
            
            storage = setup_storage(mnt_base, img_path, config.force_ext4);
            
            // **步骤 2: 扫描模块**
            auto module_list = scan_modules(config.moduledir, config);
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
        
        LOG_INFO("Plan: " + std::to_string(plan.overlay_ops.size()) + " OverlayFS ops, " +
                 std::to_string(plan.magic_module_paths.size()) + " Magic modules, " +
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
        
        // **步骤 7: 更新模块描述**
        update_module_description(
            true,  // success
            storage.mode,
            nuke_active,
            exec_result.overlay_module_ids.size(),
            exec_result.magic_module_ids.size(),
            plan.hymofs_module_ids.size()
        );
        
        // **步骤 8: 保存运行时状态**
        RuntimeState state;
        state.storage_mode = storage.mode;
        state.mount_point = storage.mount_point.string();
        state.overlay_module_ids = exec_result.overlay_module_ids;
        state.magic_module_ids = exec_result.magic_module_ids;
        state.hymofs_module_ids = plan.hymofs_module_ids;
        state.nuke_active = nuke_active;
        
        if (!state.save()) {
            LOG_ERROR("Failed to save runtime state");
        }
        
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