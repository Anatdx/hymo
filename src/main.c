#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>

#include "magic_mount.h"
#include "utils.h"

static void usage(const char *prog) {
    fprintf(stderr,
            "Magic Mount v%s\n"
            "Usage: %s [options]\n"
            "  -m DIR   module directory (default: %s)\n"
            "  -t DIR   temp directory (default: auto)\n"
            "  -s SRC   mount source (default: %s)\n"
            "  -p LIST  extra partitions (-p mi_ext,my_stock)\n"
            "  -l FILE  log file ('-' for stdout, default: stderr)\n"
            "  -v N     log level (0-3, default: 2)\n"
            "  -h       show this help\n",
            VERSION, prog, DEFAULT_MODULE_DIR, MOUNT_SOURCE);
}

int main(int argc, char **argv) {
    const char *temp_dir = NULL;
    const char *log_path = NULL;
    char auto_temp[PATH_MAX] = {0};
    int ret = 1;

    /* 解析参数 */
    for (int i = 1; i < argc; i++) {
        if ((strcmp(argv[i], "-m") == 0 || strcmp(argv[i], "--module-dir") == 0) &&
            i + 1 < argc) {
            g_config.module_dir = argv[++i];
        } else if ((strcmp(argv[i], "-t") == 0 || strcmp(argv[i], "--temp-dir") == 0) &&
                   i + 1 < argc) {
            temp_dir = argv[++i];
        } else if ((strcmp(argv[i], "-s") == 0 || strcmp(argv[i], "--mount-source") == 0) &&
                   i + 1 < argc) {
            g_config.mount_source = argv[++i];
        } else if ((strcmp(argv[i], "-l") == 0 || strcmp(argv[i], "--log-file") == 0) &&
                   i + 1 < argc) {
            log_path = argv[++i];
        } else if ((strcmp(argv[i], "-v") == 0 || strcmp(argv[i], "--verbose") == 0) &&
                   i + 1 < argc) {
            g_config.log_level = atoi(argv[++i]);
            if (g_config.log_level < 0) g_config.log_level = 0;
            if (g_config.log_level > 3) g_config.log_level = 3;
        } else if ((strcmp(argv[i], "-p") == 0 || strcmp(argv[i], "--partitions") == 0) &&
                   i + 1 < argc) {
            magic_mount_parse_partitions(argv[++i]);
        } else if (strcmp(argv[i], "-h") == 0 || strcmp(argv[i], "--help") == 0) {
            usage(argv[0]);
            return 0;
        } else {
            fprintf(stderr, "Unknown option: %s\n", argv[i]);
            usage(argv[0]);
            return 1;
        }
    }

    /* 打开日志文件 */
    if (log_path) {
        g_config.log_file = strcmp(log_path, "-") == 0 ?
                            stdout : fopen(log_path, "a");
        if (!g_config.log_file && strcmp(log_path, "-") != 0) {
            fprintf(stderr, "Failed to open log: %s\n", strerror(errno));
            return 1;
        }
    }

    /* 选择临时目录 */
    if (!temp_dir)
        temp_dir = magic_mount_select_temp_dir(auto_temp);

    /* 权限检查 */
    if (geteuid() != 0) {
        fprintf(stderr, "must run as root\n");
        goto cleanup;
    }

    /* 进入 PID1 命名空间 */
    if (magic_mount_enter_pid1_mntns() != 0)
        goto cleanup;

    /* 执行挂载 */
    fprintf(stderr, "starting: module_dir=%s temp_dir=%s source=%s level=%d\n",
            g_config.module_dir, temp_dir, g_config.mount_source, g_config.log_level);

    ret = magic_mount_run(temp_dir);

    fprintf(stderr, "%s\n", ret == 0 ? "completed successfully" : "failed");
    magic_mount_print_summary();

cleanup:
    if (g_config.log_file && g_config.log_file != stdout &&
        g_config.log_file != stderr)
        fclose(g_config.log_file);

    free_str_array(&g_config.failed_modules, &g_config.failed_count);
    free_str_array(&g_config.extra_parts, &g_config.extra_count);

    return ret == 0 ? 0 : 1;
}
