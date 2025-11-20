#include <sys/types.h>
#include <sys/stat.h>
#include <sys/mount.h>
#include <sys/xattr.h>
#include <dirent.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "magic_mount.h"
#include "utils.h"

typedef enum {
    NFT_REGULAR,
    NFT_DIRECTORY,
    NFT_SYMLINK,
    NFT_WHITEOUT
} NodeType;

typedef struct Node {
    char         *name;
    NodeType      type;
    struct Node **children;
    size_t        child_count;
    char         *module_path;
    char         *module_name;
    bool          replace;
    bool          skip;
    bool          done;
} Node;

typedef struct {
    int modules_total;
    int nodes_total;
    int nodes_mounted;
    int nodes_skipped;
    int nodes_whiteout;
    int nodes_fail;
} Stats;

static Stats g_stats = {0};

Config g_config = {
    .module_dir   = DEFAULT_MODULE_DIR,
    .mount_source = MOUNT_SOURCE,
    .log_file     = NULL,
    .log_level    = 2,
    .failed_modules = NULL,
    .failed_count   = 0,
    .extra_parts    = NULL,
    .extra_count    = 0
};

void magic_log_write(LogLevel level, const char *fmt, ...) {
    if ((int)level > g_config.log_level) return;
    static const char *level_str[] = {"ERROR", "WARN", "INFO", "DEBUG"};
    FILE *out = g_config.log_file ? g_config.log_file : stderr;

    fprintf(out, "[%s] ", level_str[level]);
    va_list ap;
    va_start(ap, fmt);
    vfprintf(out, fmt, ap);
    va_end(ap);
    fputc('\n', out);
    fflush(out);
}

static int set_selinux_context(const char *path, const char *ctx) {
    if (!path || !ctx) return 0;
    LOGD("set_selinux(%s, \"%s\")", path, ctx);
    if (lsetxattr(path, XATTR_SELINUX, ctx, strlen(ctx), 0) < 0) {
        LOGW("set_selinux %s: %s", path, strerror(errno));
        return -1;
    }
    return 0;
}

static char *get_selinux_context(const char *path) {
    if (!path) return NULL;
    ssize_t sz = lgetxattr(path, XATTR_SELINUX, NULL, 0);
    if (sz <= 0) return NULL;
    char *buf = malloc((size_t)sz + 1);
    if (!buf) return NULL;
    if (lgetxattr(path, XATTR_SELINUX, buf, (size_t)sz) != sz) {
        free(buf);
        return NULL;
    }
    buf[sz] = '\0';
    LOGD("get_selinux(%s) -> \"%s\"", path, buf);
    return buf;
}

static void copy_selinux_context(const char *src, const char *dst) {
    char *ctx = get_selinux_context(src);
    if (ctx) {
        set_selinux_context(dst, ctx);
        free(ctx);
    }
}

static Node *node_new(const char *name, NodeType type) {
    Node *n = calloc(1, sizeof(Node));
    if (!n) return NULL;
    n->name = strdup(name ? name : "");
    n->type = type;
    return n;
}

static void node_free(Node *n) {
    if (!n) return;
    for (size_t i = 0; i < n->child_count; i++)
        node_free(n->children[i]);
    free(n->children);
    free(n->name);
    free(n->module_path);
    free(n->module_name);
    free(n);
}

static NodeType get_node_type(const struct stat *st) {
    if (S_ISCHR(st->st_mode) && st->st_rdev == 0) return NFT_WHITEOUT;
    if (S_ISREG(st->st_mode))  return NFT_REGULAR;
    if (S_ISDIR(st->st_mode))  return NFT_DIRECTORY;
    if (S_ISLNK(st->st_mode))  return NFT_SYMLINK;
    return NFT_WHITEOUT;
}

static bool is_dir_opaque(const char *path) {
#ifdef __linux__
    char buf[8];
    ssize_t len = lgetxattr(path, XATTR_OPAQUE, buf, sizeof(buf) - 1);
    return len > 0 && buf[0] == 'y';
#else
    (void)path;
    return false;
#endif
}

static int node_add_child(Node *parent, Node *child) {
    Node **arr = realloc(parent->children, (parent->child_count + 1) * sizeof(Node*));
    if (!arr) return -1;
    parent->children = arr;
    parent->children[parent->child_count++] = child;
    return 0;
}

static Node *node_find_child(Node *parent, const char *name) {
    for (size_t i = 0; i < parent->child_count; i++)
        if (strcmp(parent->children[i]->name, name) == 0)
            return parent->children[i];
    return NULL;
}

static Node *node_take_child(Node *parent, const char *name) {
    for (size_t i = 0; i < parent->child_count; i++) {
        if (strcmp(parent->children[i]->name, name) == 0) {
            Node *n = parent->children[i];
            memmove(&parent->children[i], &parent->children[i + 1],
                    (parent->child_count - i - 1) * sizeof(Node*));
            parent->child_count--;
            return n;
        }
    }
    return NULL;
}

static Node *create_node_from_path(const char *name, const char *path,
                                   const char *module_name) {
    struct stat st;
    if (lstat(path, &st) < 0) return NULL;
    if (!(S_ISCHR(st.st_mode) || S_ISREG(st.st_mode) ||
          S_ISDIR(st.st_mode) || S_ISLNK(st.st_mode)))
        return NULL;
    NodeType type = get_node_type(&st);
    Node *n = node_new(name, type);
    if (!n) return NULL;
    n->module_path = strdup(path);
    n->module_name = module_name ? strdup(module_name) : NULL;
    n->replace = (type == NFT_DIRECTORY) && is_dir_opaque(path);
    g_stats.nodes_total++;
    return n;
}

static bool is_module_disabled(const char *mod_dir) {
    char buf[PATH_MAX];
    const char *disable_files[] = {DISABLE_FILE, REMOVE_FILE, SKIP_MOUNT_FILE};
    for (size_t i = 0; i < ARR_LEN(disable_files); i++) {
        if (path_join(buf, sizeof(buf), mod_dir, disable_files[i]) == 0 &&
            path_exists(buf))
            return true;
    }
    return false;
}

static int collect_module_files(Node *node, const char *dir,
                                const char *module_name, bool *has_any) {
    DIR *d = opendir(dir);
    if (!d) {
        LOGE("opendir %s: %s", dir, strerror(errno));
        return -1;
    }

    char path[PATH_MAX];
    struct dirent *de;
    bool any = false;

    while ((de = readdir(d))) {
        if (is_dot_or_dotdot(de->d_name)) continue;
        if (path_join(path, sizeof(path), dir, de->d_name) != 0) {
            closedir(d);
            return -1;
        }
        Node *child = node_find_child(node, de->d_name);
        if (!child) {
            child = create_node_from_path(de->d_name, path, module_name);
            if (child && node_add_child(node, child) != 0) {
                node_free(child);
                closedir(d);
                return -1;
            }
        }
        if (child && child->type == NFT_DIRECTORY) {
            bool sub = false;
            if (collect_module_files(child, path, module_name, &sub) != 0) {
                closedir(d);
                return -1;
            }
            if (sub || child->replace) any = true;
        } else if (child) {
            any = true;
        }
    }
    closedir(d);
    *has_any = any;
    return 0;
}

static int add_partition_nodes(Node *root, Node *system) {
    struct { const char *name; bool need_symlink; } parts[] = {
        {"vendor",     true},
        {"system_ext", true},
        {"product",    true},
        {"odm",        false}
    };

    char root_path[PATH_MAX], sys_path[PATH_MAX];

    for (size_t i = 0; i < ARR_LEN(parts); i++) {
        if (path_join(root_path, sizeof(root_path), "/", parts[i].name) != 0 ||
            path_join(sys_path, sizeof(sys_path), "/system", parts[i].name) != 0)
            return -1;
        if (!is_dir(root_path)) continue;
        if (parts[i].need_symlink && !is_symlink(sys_path)) continue;
        Node *child = node_take_child(system, parts[i].name);
        if (child && node_add_child(root, child) != 0) {
            node_free(child);
            return -1;
        }
    }

    for (int i = 0; i < g_config.extra_count; i++) {
        if (path_join(root_path, sizeof(root_path), "/", g_config.extra_parts[i]) != 0)
            return -1;
        if (!is_dir(root_path)) continue;
        Node *child = node_take_child(system, g_config.extra_parts[i]);
        if (child && node_add_child(root, child) != 0) {
            node_free(child);
            return -1;
        }
    }
    return 0;
}

static Node *scan_modules(void) {
    Node *root = node_new("", NFT_DIRECTORY);
    Node *system = node_new("system", NFT_DIRECTORY);
    if (!root || !system) {
        node_free(root);
        node_free(system);
        return NULL;
    }

    DIR *d = opendir(g_config.module_dir);
    if (!d) {
        LOGE("opendir %s: %s", g_config.module_dir, strerror(errno));
        node_free(root);
        node_free(system);
        return NULL;
    }

    char mod_path[PATH_MAX], sys_path[PATH_MAX];
    struct dirent *de;
    bool has_any = false;

    while ((de = readdir(d))) {
        if (is_dot_or_dotdot(de->d_name)) continue;
        if (path_join(mod_path, sizeof(mod_path), g_config.module_dir, de->d_name) != 0)
            continue;
        if (!is_dir(mod_path) || is_module_disabled(mod_path)) continue;
        if (path_join(sys_path, sizeof(sys_path), mod_path, "system") != 0)
            continue;
        if (!is_dir(sys_path)) continue;

        LOGD("scanning module: %s", de->d_name);
        g_stats.modules_total++;

        bool sub = false;
        if (collect_module_files(system, sys_path, de->d_name, &sub) == 0 && sub)
            has_any = true;
    }

    closedir(d);

    if (!has_any) {
        node_free(root);
        node_free(system);
        return NULL;
    }

    g_stats.nodes_total += 2;  /* root + system */

    if (add_partition_nodes(root, system) != 0) {
        node_free(root);
        node_free(system);
        return NULL;
    }

    if (node_add_child(root, system) != 0) {
        node_free(root);
        node_free(system);
        return NULL;
    }
    return root;
}

static int clone_symlink(const char *src, const char *dst) {
    char target[PATH_MAX];
    ssize_t len = readlink(src, target, sizeof(target) - 1);
    if (len < 0) {
        LOGE("readlink %s: %s", src, strerror(errno));
        return -1;
    }
    target[len] = '\0';
    if (symlink(target, dst) < 0) {
        LOGE("symlink %s->%s: %s", dst, target, strerror(errno));
        return -1;
    }
    copy_selinux_context(src, dst);
    LOGD("clone_symlink: %s -> %s", dst, target);
    return 0;
}

static int mirror_file(const char *src, const char *dst, const struct stat *st) {
    int fd = open(dst, O_CREAT | O_WRONLY, st->st_mode & 07777);
    if (fd < 0) {
        LOGE("create %s: %s", dst, strerror(errno));
        return -1;
    }
    close(fd);
    if (mount(src, dst, NULL, MS_BIND, NULL) < 0) {
        LOGE("bind %s->%s: %s", src, dst, strerror(errno));
        return -1;
    }
    return 0;
}

static int mirror_dir(const char *src, const char *dst, const struct stat *st);

static int mirror_entry(const char *src_base, const char *dst_base, const char *name) {
    char src[PATH_MAX], dst[PATH_MAX];
    if (path_join(src, sizeof(src), src_base, name) != 0 ||
        path_join(dst, sizeof(dst), dst_base, name) != 0)
        return -1;
    struct stat st;
    if (lstat(src, &st) < 0) {
        LOGW("lstat %s: %s", src, strerror(errno));
        return 0;
    }
    if (S_ISREG(st.st_mode))      return mirror_file(src, dst, &st);
    else if (S_ISDIR(st.st_mode)) return mirror_dir(src, dst, &st);
    else if (S_ISLNK(st.st_mode)) return clone_symlink(src, dst);
    return 0;
}

static int mirror_dir(const char *src, const char *dst, const struct stat *st) {
    if (mkdir(dst, st->st_mode & 07777) < 0 && errno != EEXIST) {
        LOGE("mkdir %s: %s", dst, strerror(errno));
        return -1;
    }
    chmod(dst, st->st_mode & 07777);
    chown(dst, st->st_uid, st->st_gid);
    copy_selinux_context(src, dst);

    DIR *d = opendir(src);
    if (!d) {
        LOGE("opendir %s: %s", src, strerror(errno));
        return -1;
    }

    struct dirent *de;
    int ret = 0;
    while ((de = readdir(d))) {
        if (is_dot_or_dotdot(de->d_name)) continue;
        if (mirror_entry(src, dst, de->d_name) != 0) {
            ret = -1;
            break;
        }
    }
    closedir(d);
    return ret;
}

static int mount_regular_file(Node *node, const char *path,
                              const char *wpath, bool has_tmpfs) {
    const char *target = has_tmpfs ? wpath : path;
    if (has_tmpfs) {
        int fd = open(wpath, O_CREAT | O_WRONLY, 0644);
        if (fd < 0) {
            LOGE("create %s: %s", wpath, strerror(errno));
            return -1;
        }
        close(fd);
    }
    if (!node->module_path) {
        LOGE("no module_path for %s", path);
        return -1;
    }
    LOGD("bind %s -> %s", node->module_path, target);
    if (mount(node->module_path, target, NULL, MS_BIND, NULL) < 0) {
        LOGE("bind %s->%s: %s", node->module_path, target, strerror(errno));
        return -1;
    }
    mount(NULL, target, NULL, MS_REMOUNT | MS_BIND | MS_RDONLY, NULL);
    g_stats.nodes_mounted++;
    return 0;
}

static int mount_directory(Node *node, const char *path,
                           const char *wpath, bool has_tmpfs);

static int process_child(Node *child, const char *path,
                         const char *wpath, bool has_tmpfs) {
    if (child->skip) {
        child->done = true;
        return 0;
    }
    child->done = true;
    return mount_directory(child, path, wpath, has_tmpfs);
}

static bool need_tmpfs_for_child(Node *child, const char *real_path) {
    char path[PATH_MAX];
    if (path_join(path, sizeof(path), real_path, child->name) != 0)
        return false;
    if (child->type == NFT_SYMLINK)  return true;
    if (child->type == NFT_WHITEOUT) return path_exists(path);

    struct stat st;
    if (lstat(path, &st) < 0) return true;
    NodeType real_type = get_node_type(&st);
    return real_type != child->type || real_type == NFT_SYMLINK;
}

static bool check_need_tmpfs(Node *node, const char *path, bool has_tmpfs) {
    if (!has_tmpfs && node->replace && node->module_path)
        return true;
    for (size_t i = 0; i < node->child_count; i++)
        if (need_tmpfs_for_child(node->children[i], path))
            return true;
    return false;
}

static int setup_tmpfs_dir(const char *wpath, const char *path,
                           const char *module_path) {
    if (mkdir_recursive(wpath) != 0) return -1;
    struct stat st;
    const char *meta = NULL;
    if (stat(path, &st) == 0) meta = path;
    else if (module_path && stat(module_path, &st) == 0) meta = module_path;
    else {
        LOGE("no metadata for %s", path);
        return -1;
    }
    chmod(wpath, st.st_mode & 07777);
    chown(wpath, st.st_uid, st.st_gid);
    copy_selinux_context(meta, wpath);
    return 0;
}

static int mount_directory(Node *node, const char *base_path,
                           const char *base_work, bool has_tmpfs) {
    char path[PATH_MAX], wpath[PATH_MAX];
    if (path_join(path, sizeof(path), base_path, node->name) != 0 ||
        path_join(wpath, sizeof(wpath), base_work, node->name) != 0)
        return -1;

    bool create_tmpfs = check_need_tmpfs(node, path, has_tmpfs);
    bool now_tmpfs = has_tmpfs || create_tmpfs;

    if (now_tmpfs && setup_tmpfs_dir(wpath, path, node->module_path) != 0)
        return -1;

    if (create_tmpfs &&
        mount(wpath, wpath, NULL, MS_BIND, NULL) < 0) {
        LOGE("bind self %s: %s", wpath, strerror(errno));
        return -1;
    }

    /* 处理原目录内容 */
    if (path_exists(path) && !node->replace) {
        DIR *d = opendir(path);
        if (d) {
            struct dirent *de;
            while ((de = readdir(d))) {
                if (is_dot_or_dotdot(de->d_name)) continue;
                Node *child = node_find_child(node, de->d_name);
                int ret = child
                          ? process_child(child, path, wpath, now_tmpfs)
                          : (now_tmpfs ? mirror_entry(path, wpath, de->d_name) : 0);
                if (ret != 0) {
                    const char *mod = (child && child->module_name)
                                      ? child->module_name : node->module_name;
                    if (mod) {
                        LOGE("child %s/%s failed (module: %s)", path, de->d_name, mod);
                        add_to_array(&g_config.failed_modules,
                                     &g_config.failed_count, mod);
                    }
                    g_stats.nodes_fail++;
                    if (now_tmpfs) {
                        closedir(d);
                        return -1;
                    }
                }
            }
            closedir(d);
        } else if (now_tmpfs) {
            LOGE("opendir %s: %s", path, strerror(errno));
            return -1;
        }
    }

    for (size_t i = 0; i < node->child_count; i++) {
        Node *child = node->children[i];
        if (child->skip || child->done) continue;
        if (process_child(child, path, wpath, now_tmpfs) != 0) {
            const char *mod = child->module_name ? child->module_name : node->module_name;
            if (mod) {
                LOGE("child %s/%s failed (module: %s)", path, child->name, mod);
                add_to_array(&g_config.failed_modules, &g_config.failed_count, mod);
            }
            g_stats.nodes_fail++;
            if (now_tmpfs) return -1;
        }
    }

    if (create_tmpfs) {
        mount(NULL, wpath, NULL, MS_REMOUNT | MS_BIND | MS_RDONLY, NULL);
        if (mount(wpath, path, NULL, MS_MOVE, NULL) < 0) {
            LOGE("move %s->%s: %s", wpath, path, strerror(errno));
            if (node->module_name)
                add_to_array(&g_config.failed_modules,
                             &g_config.failed_count, node->module_name);
            return -1;
        }
        LOGI("moved tmpfs: %s -> %s", wpath, path);
        mount(NULL, path, NULL, MS_REC | MS_PRIVATE, NULL);
    }

    g_stats.nodes_mounted++;
    return 0;
}

static int mount_node(Node *node, const char *path,
                      const char *wpath, bool has_tmpfs) {
    switch (node->type) {
    case NFT_REGULAR:
        return mount_regular_file(node, path, wpath, has_tmpfs);
    case NFT_SYMLINK:
        if (!node->module_path) {
            LOGE("no module_path for symlink %s", path);
            return -1;
        }
        if (clone_symlink(node->module_path, wpath) == 0) {
            g_stats.nodes_mounted++;
            return 0;
        }
        return -1;
    case NFT_WHITEOUT:
        LOGD("whiteout: %s", path);
        g_stats.nodes_whiteout++;
        return 0;
    case NFT_DIRECTORY:
        return mount_directory(node, "/", wpath, has_tmpfs);
    }
    return 0;
}

const char *magic_mount_select_temp_dir(char *buf) {
    const char *candidates[] = {"/mnt/vendor", "/mnt", "/debug_ramdisk"};
    for (size_t i = 0; i < ARR_LEN(candidates); i++) {
        if (!is_rw_tmpfs(candidates[i])) continue;
        if (path_join(buf, PATH_MAX, candidates[i], ".magic_mount") == 0) {
            LOGI("auto temp_dir: %s (from %s)", buf, candidates[i]);
            return buf;
        }
    }
    LOGW("no rw tmpfs, using fallback: %s", DEFAULT_TEMP_DIR);
    return DEFAULT_TEMP_DIR;
}

int magic_mount_run(const char *temp_root) {
    Node *root = scan_modules();
    if (!root) {
        LOGI("no modules found");
        return 0;
    }

    char tmpfs_dir[PATH_MAX];
    if (path_join(tmpfs_dir, sizeof(tmpfs_dir), temp_root, "workdir") != 0) {
        node_free(root);
        return -1;
    }
    if (mkdir_recursive(tmpfs_dir) != 0) {
        node_free(root);
        return -1;
    }

    LOGI("mounting tmpfs: %s (source=%s)", tmpfs_dir, g_config.mount_source);
    if (mount(g_config.mount_source, tmpfs_dir, "tmpfs", 0, "") < 0) {
        LOGE("mount tmpfs %s: %s", tmpfs_dir, strerror(errno));
        node_free(root);
        return -1;
    }
    mount(NULL, tmpfs_dir, NULL, MS_REC | MS_PRIVATE, NULL);

    int ret = mount_node(root, "/", tmpfs_dir, false);
    if (ret != 0) g_stats.nodes_fail++;

    umount2(tmpfs_dir, MNT_DETACH);
    rmdir(tmpfs_dir);
    node_free(root);
    return ret;
}

int magic_mount_enter_pid1_mntns(void) {
    int fd = open("/proc/1/ns/mnt", O_RDONLY);
    if (fd < 0) {
        LOGE("open /proc/1/ns/mnt: %s", strerror(errno));
        return -1;
    }
    if (setns(fd, 0) < 0) {
        LOGE("setns: %s", strerror(errno));
        close(fd);
        return -1;
    }
    close(fd);
    LOGI("entered pid1 mount namespace");
    return 0;
}

void magic_mount_print_summary(void) {
    LOGI("summary: modules=%d nodes=%d mounted=%d skipped=%d whiteouts=%d failures=%d",
         g_stats.modules_total, g_stats.nodes_total, g_stats.nodes_mounted,
         g_stats.nodes_skipped, g_stats.nodes_whiteout, g_stats.nodes_fail);
    if (g_config.failed_count > 0) {
        LOGW("failed modules (%d):", g_config.failed_count);
        for (int i = 0; i < g_config.failed_count; i++)
            LOGW("  - %s", g_config.failed_modules[i]);
    }
}

void magic_mount_parse_partitions(const char *list) {
    const char *p = list;
    while (*p) {
        const char *start = p;
        while (*p && *p != ',') p++;
        size_t len = (size_t)(p - start);

        while (len > 0 && (start[0] == ' ' || start[0] == '\t')) {
            start++;
            len--;
        }
        while (len > 0 && (start[len-1] == ' ' || start[len-1] == '\t'))
            len--;

        if (len > 0) {
            char *name = malloc(len + 1);
            if (name) {
                memcpy(name, start, len);
                name[len] = '\0';
                add_to_array(&g_config.extra_parts, &g_config.extra_count, name);
                free(name);
            }
        }
        if (*p == ',') p++;
    }
}
