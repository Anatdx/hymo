#include <sys/types.h>
#include <sys/stat.h>
#include <sys/statfs.h>
#include <dirent.h>
#include <unistd.h>
#include <errno.h>
#include <limits.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>

#include "utils.h"

int path_join(char *buf, size_t n, const char *base, const char *name) {
    if (!base) return -1;
    if (!name || !name[0]) return snprintf(buf, n, "%s", base) >= (int)n ? -1 : 0;
    size_t len = strlen(base);
    bool has_slash = (len > 0 && base[len-1] == '/');
    return snprintf(buf, n, has_slash ? "%s%s" : "%s/%s", base, name) >= (int)n ? -1 : 0;
}

bool path_exists(const char *p) { return access(p, F_OK) == 0; }

bool is_dir(const char *p) {
    struct stat st;
    return stat(p, &st) == 0 && S_ISDIR(st.st_mode);
}

bool is_symlink(const char *p) {
    struct stat st;
    return lstat(p, &st) == 0 && S_ISLNK(st.st_mode);
}

int mkdir_recursive(const char *dir) {
    if (!dir || !dir[0]) return -1;
    if (is_dir(dir)) return 0;

    char tmp[PATH_MAX];
    if (snprintf(tmp, sizeof(tmp), "%s", dir) >= (int)sizeof(tmp)) return -1;

    char *p = strrchr(tmp, '/');
    if (p && p != tmp) {
        *p = 0;
        if (mkdir_recursive(tmp) != 0) return -1;
    }
    return (mkdir(dir, 0755) == 0 || errno == EEXIST) ? 0 : -1;
}

bool is_rw_tmpfs(const char *path) {
    struct statfs s;
    if (!is_dir(path) || statfs(path, &s) < 0) return false;
    if ((unsigned long)s.f_type != TMPFS_MAGIC) return false;

    char tmp[PATH_MAX];
    if (path_join(tmp, sizeof(tmp), path, ".test_XXXXXX") != 0) return false;

    int fd = mkstemp(tmp);
    if (fd < 0) return false;
    close(fd);
    unlink(tmp);
    return true;
}

void free_str_array(char ***arr, int *count) {
    if (!arr || !*arr) return;
    for (int i = 0; i < *count; i++) free((*arr)[i]);
    free(*arr);
    *arr = NULL;
    *count = 0;
}

void add_to_array(char ***arr, int *count, const char *str) {
    for (int i = 0; i < *count; i++)
        if (strcmp((*arr)[i], str) == 0) return;

    char **new_arr = realloc(*arr, (size_t)(*count + 1) * sizeof(char*));
    if (!new_arr) return;

    *arr = new_arr;
    (*arr)[*count] = strdup(str);
    if ((*arr)[*count]) (*count)++;
}

bool is_dot_or_dotdot(const char *n) {
    return n && (!strcmp(n, ".") || !strcmp(n, ".."));
}
