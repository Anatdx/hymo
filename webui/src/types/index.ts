export const PATHS = {
  BINARY: '/data/adb/modules/hymo/hymod',
  CONFIG: '/data/adb/hymo/config.json',
  MODE_CONFIG: '/data/adb/hymo/module_mode.json',
  RULES_CONFIG: '/data/adb/hymo/module_rules.json',
  DEFAULT_LOG: '/data/adb/hymo/daemon.log',
} as const

export const DEFAULT_CONFIG = {
  moduledir: '/data/adb/modules',
  tempdir: '',
  mountsource: 'KSU',
  logfile: PATHS.DEFAULT_LOG,
  debug: false,
  verbose: false,
  fs_type: 'auto',
  disable_umount: false,
  enable_nuke: true,
  ignore_protocol_mismatch: false,
  enable_kernel_debug: false,
  enable_stealth: true,
  hymofs_enabled: true,
  uname_release: '',
  uname_version: '',
  mount_stage: 'metamount',
  partitions: [] as string[],
  hymofs_available: false,
  tmpfs_xattr_supported: false,
}

export const BUILTIN_PARTITIONS = [
  'system',
  'vendor',
  'product',
  'system_ext',
  'odm',
  'oem',
]

export type Config = typeof DEFAULT_CONFIG
export type Module = {
  id: string
  name: string
  version: string
  author: string
  description: string
  mode: 'auto' | 'hymofs' | 'overlay' | 'magic'
  strategy: string
  path: string
  rules: Array<{
    path: string
    mode: string
  }>
}

export type StorageInfo = {
  size: string
  used: string
  avail: string
  percent: number
  mode: 'tmpfs' | 'ext4' | 'erofs' | 'hymofs' | null
}

export type SystemInfo = {
  kernel: string
  selinux: string
  mountBase: string
  unameRelease?: string
  unameVersion?: string
  hymofsModules?: string[]
  hymofsMismatch?: boolean
  mismatchMessage?: string
  hooks?: string
  mountStats?: MountStatistics
  detectedPartitions?: PartitionInfo[]
}

export type MountStatistics = {
  total_mounts: number
  successful_mounts: number
  failed_mounts: number
  tmpfs_created: number
  files_mounted: number
  dirs_mounted: number
  symlinks_created: number
  overlayfs_mounts: number
  success_rate?: number
}

export type PartitionInfo = {
  name: string
  mount_point: string
  fs_type: string
  is_read_only: boolean
  exists_as_symlink: boolean
}
