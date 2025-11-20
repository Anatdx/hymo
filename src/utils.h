#ifndef UTILS_H
#define UTILS_H

#include <stdbool.h>
#include <stddef.h>

#ifndef PATH_MAX
#define PATH_MAX 4096
#endif

#ifndef TMPFS_MAGIC
#define TMPFS_MAGIC 0x01021994
#endif

int  path_join(char *buf, size_t n, const char *base, const char *name);
bool path_exists(const char *p);
bool is_dir(const char *p);
bool is_symlink(const char *p);
int  mkdir_recursive(const char *dir);
bool is_rw_tmpfs(const char *path);

void free_str_array(char ***arr, int *count);
void add_to_array(char ***arr, int *count, const char *str);

bool is_dot_or_dotdot(const char *n);

#endif /* UTILS_H */
