export const PATHS = {
  BINARY: '/data/adb/modules/hymo/hymod',
  CONFIG: '/data/adb/hymo/config.toml',
  MODE_CONFIG: '/data/adb/hymo/module_mode.conf',
  RULES_CONFIG: '/data/adb/hymo/module_rules.conf',
  DEFAULT_LOG: '/data/adb/hymo/daemon.log',
} as const

export const DEFAULT_CONFIG = {
  moduledir: '/data/adb/modules',
  tempdir: '',
  mountsource: 'KSU',
  logfile: PATHS.DEFAULT_LOG,
  verbose: false,
  force_ext4: false,
  prefer_erofs: false,
  disable_umount: false,
  enable_nuke: true,
  ignore_protocol_mismatch: false,
  enable_kernel_debug: false,
  enable_stealth: true,
  partitions: [] as string[],
  hymofs_available: false,
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
  hymofsModules?: string[]
  hymofsMismatch?: boolean
  mismatchMessage?: string
}
