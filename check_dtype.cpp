#include <stdio.h>
#include <dirent.h>
#include <string.h>

int main(int argc, char** argv) {
    if (argc < 2) return 1;
    DIR* dir = opendir(argv[1]);
    if (!dir) {
        perror("opendir");
        return 1;
    }
    struct dirent* entry;
    while ((entry = readdir(dir)) != NULL) {
        if (strstr(entry->d_name, "Monet") != NULL) {
            printf("Found: %s, d_type: %d\n", entry->d_name, entry->d_type);
        }
    }
    closedir(dir);
    return 0;
}
