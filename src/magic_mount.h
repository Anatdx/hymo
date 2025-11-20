#ifndef MAGIC_MOUNT_H
#define MAGIC_MOUNT_H

#include <stdio.h>

#define DEFAULT_MODULE_DIR  "/data/adb/modules"
#define DEFAULT_TEMP_DIR    "/dev/.magic_mount"
#define MOUNT_SOURCE        "KSU"

#define DISABLE_FILE        "disable"
#define REMOVE_FILE         "remove"
#define SKIP_MOUNT_FILE     "skip_mount"

#define XATTR_OPAQUE        "trusted.overlay.opaque"
#define XATTR_SELINUX       "security.selinux"

#define ARR_LEN(a)          (sizeof(a) / sizeof((a)[0]))

typedef enum {
    LOG_ERROR = 0,
    LOG_WARN  = 1,
    LOG_INFO  = 2,
    LOG_DEBUG = 3
} LogLevel;

typedef struct {
    const char  *module_dir;
    const char  *mount_source;
    FILE        *log_file;
    int          log_level;
    char       **failed_modules;
    int          failed_count;
    char       **extra_parts;
    int          extra_count;
} Config;

extern Config g_config;

// shim
int setns(int fd, int nstype);

void magic_log_write(LogLevel level, const char *fmt, ...);

#define LOGE(...) magic_log_write(LOG_ERROR, __VA_ARGS__)
#define LOGW(...) magic_log_write(LOG_WARN,  __VA_ARGS__)
#define LOGI(...) magic_log_write(LOG_INFO,  __VA_ARGS__)
#define LOGD(...) magic_log_write(LOG_DEBUG, __VA_ARGS__)

const char *magic_mount_select_temp_dir(char *buf);
int  magic_mount_run(const char *temp_root);
int  magic_mount_enter_pid1_mntns(void);
void magic_mount_print_summary(void);
void magic_mount_parse_partitions(const char *list);

#endif /* MAGIC_MOUNT_H */
