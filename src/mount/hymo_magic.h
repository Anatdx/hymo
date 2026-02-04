#ifndef _LINUX_HYMO_MAGIC_H
#define _LINUX_HYMO_MAGIC_H

#ifdef __KERNEL__
#include <linux/bits.h>
#include <linux/ioctl.h>
#include <linux/types.h>
#else
#include <stddef.h>
#include <stdint.h>
#include <sys/ioctl.h>
#endif // #ifdef __KERNEL__

#define HYMO_MAGIC1 0x48594D4F  // "HYMO"
#define HYMO_MAGIC2 0x524F4F54  // "ROOT"
#define HYMO_PROTOCOL_VERSION 12

#define HYMO_MAX_LEN_PATHNAME 256
#define HYMO_FAKE_CMDLINE_SIZE 4096

/*
 * HymoFS inode marking bits (stored in inode->i_mapping->flags)
 * Using high bits to avoid conflict with kernel AS_* flags and SUSFS bits
 * SUSFS uses bits 33-39, we use 40+
 */
#ifdef __KERNEL__
#define AS_FLAGS_HYMO_HIDE 40
#define BIT_HYMO_HIDE BIT(40)
/* Marks a directory as containing hidden entries (for fast filldir skip) */
#define AS_FLAGS_HYMO_DIR_HAS_HIDDEN 41
#define BIT_HYMO_DIR_HAS_HIDDEN BIT(41)
/* Marks an inode for kstat spoofing */
#define AS_FLAGS_HYMO_SPOOF_KSTAT 42
#define BIT_HYMO_SPOOF_KSTAT BIT(42)
#endif // #ifdef __KERNEL__

/*
 * Syscall commands (via reboot syscall):
 * - GET_FD: legacy, only returns anonymous fd
 * - GET_FD_WITH_MASK: bootstrap fast path, sets hook mask immediately (arg register)
 */
#define HYMO_CMD_GET_FD 0x48021
#define HYMO_CMD_GET_FD_WITH_MASK 0x48022

/*
 * Internal command definitions (used with HYMO_IOC_CALL).
 * Must match kernel-side hymofs_kpm/hymofs.h.
 */
#define HYMO_CMD_CLEAR_ALL 100
#define HYMO_CMD_GET_VERSION 101
#define HYMO_CMD_SET_DEBUG 102
#define HYMO_CMD_REORDER_MNT_ID 103
#define HYMO_CMD_SET_STEALTH 104
#define HYMO_CMD_SET_ENABLED 105
#define HYMO_CMD_LIST_RULES 106
#define HYMO_CMD_SET_MIRROR_PATH 107
#define HYMO_CMD_ADD_MERGE_RULE 108
#define HYMO_CMD_ADD_RULE 109
#define HYMO_CMD_HIDE_RULE 110
#define HYMO_CMD_HIDE_OVERLAY_XATTRS 111
#define HYMO_CMD_DEL_RULE 112
#define HYMO_CMD_ADD_SPOOF_KSTAT 113
#define HYMO_CMD_UPDATE_SPOOF_KSTAT 114
#define HYMO_CMD_SET_UNAME 115
#define HYMO_CMD_SET_CMDLINE 116
#define HYMO_CMD_SET_HOOK_MASK 117

/*
 * KPM runtime hook mask bits (must match hymofs_kpm/hymofs.c).
 * Default: enable all hooks at bootstrap (post-fs-data).
 */
#define HYMO_HOOK_DIRENTS (1ULL << 0)
#define HYMO_HOOK_FILENAME_LOOKUP (1ULL << 1)
#define HYMO_HOOK_SHOW_MOUNTINFO (1ULL << 2)
#define HYMO_HOOK_SETXATTR (1ULL << 3)
#define HYMO_HOOK_GETXATTR (1ULL << 4)
#define HYMO_HOOK_LISTXATTR (1ULL << 5)
#define HYMO_HOOK_RENAME (1ULL << 6)
#define HYMO_HOOK_UNLINK (1ULL << 7)
#define HYMO_HOOK_READLINK (1ULL << 8)
#define HYMO_HOOK_CMDLINE (1ULL << 9)
#define HYMO_HOOK_ALL                                                                            \
    (HYMO_HOOK_DIRENTS | HYMO_HOOK_FILENAME_LOOKUP | HYMO_HOOK_SHOW_MOUNTINFO | HYMO_HOOK_SETXATTR | \
     HYMO_HOOK_GETXATTR | HYMO_HOOK_LISTXATTR | HYMO_HOOK_RENAME | HYMO_HOOK_UNLINK |             \
     HYMO_HOOK_READLINK | HYMO_HOOK_CMDLINE)

struct hymo_syscall_arg {
    const char* src;
    const char* target;
    int type;
};

struct hymo_syscall_list_arg {
    char* buf;  // Keep as char* for output buffer
    size_t size;
};

/*
 * kstat spoofing structure - allows full control over stat() results
 * Similar to susfs sus_kstat but with HymoFS conventions
 */
struct hymo_spoof_kstat {
    unsigned long target_ino;                    /* Target inode number (after mount/overlay) */
    char target_pathname[HYMO_MAX_LEN_PATHNAME]; /* Path to spoof */
    unsigned long spoofed_ino;                   /* Spoofed inode number */
    unsigned long spoofed_dev;                   /* Spoofed device number */
    unsigned int spoofed_nlink;                  /* Spoofed link count */
    long long spoofed_size;                      /* Spoofed file size */
    long spoofed_atime_sec;                      /* Spoofed access time (seconds) */
    long spoofed_atime_nsec;                     /* Spoofed access time (nanoseconds) */
    long spoofed_mtime_sec;                      /* Spoofed modification time (seconds) */
    long spoofed_mtime_nsec;                     /* Spoofed modification time (nanoseconds) */
    long spoofed_ctime_sec;                      /* Spoofed change time (seconds) */
    long spoofed_ctime_nsec;                     /* Spoofed change time (nanoseconds) */
    unsigned long spoofed_blksize;               /* Spoofed block size */
    unsigned long long spoofed_blocks;           /* Spoofed block count */
    int is_static;                               /* If true, ino won't change after remount */
    int err;                                     /* Error code for userspace feedback */
};

/*
 * uname spoofing structure - spoof kernel version info
 */
#define HYMO_UNAME_LEN 65
struct hymo_spoof_uname {
    char sysname[HYMO_UNAME_LEN];
    char nodename[HYMO_UNAME_LEN];
    char release[HYMO_UNAME_LEN]; /* e.g., "5.15.0-generic" */
    char version[HYMO_UNAME_LEN]; /* e.g., "#1 SMP PREEMPT ..." */
    char machine[HYMO_UNAME_LEN];
    char domainname[HYMO_UNAME_LEN];
    int err;
};

/*
 * cmdline spoofing structure - spoof /proc/cmdline
 */
struct hymo_spoof_cmdline {
    char cmdline[HYMO_FAKE_CMDLINE_SIZE]; /* Fake cmdline content */
    int err;
};

/*
 * Feature flags for HYMO_CMD_GET_FEATURES
 */
#define HYMO_FEATURE_KSTAT_SPOOF (1 << 0)
#define HYMO_FEATURE_UNAME_SPOOF (1 << 1)
#define HYMO_FEATURE_CMDLINE_SPOOF (1 << 2)
#define HYMO_FEATURE_SELINUX_BYPASS (1 << 4)
#define HYMO_FEATURE_MERGE_DIR (1 << 5)

// ioctl definitions (for fd-based mode)
// Must be after struct definitions
#define HYMO_IOC_MAGIC 'H'
#define HYMO_IOC_ADD_RULE _IOW(HYMO_IOC_MAGIC, 1, struct hymo_syscall_arg)
#define HYMO_IOC_DEL_RULE _IOW(HYMO_IOC_MAGIC, 2, struct hymo_syscall_arg)
#define HYMO_IOC_HIDE_RULE _IOW(HYMO_IOC_MAGIC, 3, struct hymo_syscall_arg)
#define HYMO_IOC_CLEAR_ALL _IO(HYMO_IOC_MAGIC, 5)
#define HYMO_IOC_GET_VERSION _IOR(HYMO_IOC_MAGIC, 6, int)
#define HYMO_IOC_LIST_RULES _IOWR(HYMO_IOC_MAGIC, 7, struct hymo_syscall_list_arg)
#define HYMO_IOC_SET_DEBUG _IOW(HYMO_IOC_MAGIC, 8, int)
#define HYMO_IOC_REORDER_MNT_ID _IO(HYMO_IOC_MAGIC, 9)
#define HYMO_IOC_SET_STEALTH _IOW(HYMO_IOC_MAGIC, 10, int)
#define HYMO_IOC_HIDE_OVERLAY_XATTRS _IOW(HYMO_IOC_MAGIC, 11, struct hymo_syscall_arg)
#define HYMO_IOC_ADD_MERGE_RULE _IOW(HYMO_IOC_MAGIC, 12, struct hymo_syscall_arg)
#define HYMO_IOC_SET_MIRROR_PATH _IOW(HYMO_IOC_MAGIC, 14, struct hymo_syscall_arg)
#define HYMO_IOC_ADD_SPOOF_KSTAT _IOW(HYMO_IOC_MAGIC, 15, struct hymo_spoof_kstat)
#define HYMO_IOC_UPDATE_SPOOF_KSTAT _IOW(HYMO_IOC_MAGIC, 16, struct hymo_spoof_kstat)
#define HYMO_IOC_SET_UNAME _IOW(HYMO_IOC_MAGIC, 17, struct hymo_spoof_uname)
#define HYMO_IOC_SET_CMDLINE _IOW(HYMO_IOC_MAGIC, 18, struct hymo_spoof_cmdline)
#define HYMO_IOC_GET_FEATURES _IOR(HYMO_IOC_MAGIC, 19, int)
#define HYMO_IOC_SET_ENABLED _IOW(HYMO_IOC_MAGIC, 20, int)

/*
 * Unified ioctl (recommended): pass cmd + arg pointer, kernel does the dispatch.
 * This replaces the large HYMO_IOC_* surface for most use cases.
 */
struct hymo_ioctl_call {
    uint32_t cmd;       /* HYMO_CMD_* */
    uint32_t reserved;  /* must be 0 */
    uint64_t arg;       /* (void*) for cmd-specific argument */
};
#define HYMO_IOC_CALL _IOW(HYMO_IOC_MAGIC, 22, struct hymo_ioctl_call)

#endif /* _LINUX_HYMO_MAGIC_H */