// Constants for paths and defaults
export const PATHS = {
  BINARY: '/data/adb/modules/hymo/hymod',
  CONFIG: '/data/adb/hymo/config.toml',
  MODE_CONFIG: '/data/adb/hymo/mode.conf',
  RULES_CONFIG: '/data/adb/hymo/rules.conf',
  DEFAULT_LOG: '/data/adb/hymo/hymo.log',
} as const

export const DEFAULT_CONFIG = {
  moduledir: '/data/adb/modules',
  tempdir: '',
  mountsource: 'overlay',
  logfile: PATHS.DEFAULT_LOG,
  verbose: false,
  force_ext4: false,
  disable_umount: false,
  enable_nuke: false,
  ignore_protocol_mismatch: false,
  enable_kernel_debug: false,
  enable_stealth: false,
  avc_spoof: false,
  partitions: [] as string[],
  hymofs_available: false,
}

export const BUILTIN_PARTITIONS = [
  'system',
  'vendor',
  'product',
  'system_ext',
  'odm',
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
  percent: string
  type: 'tmpfs' | 'ext4' | 'hymofs' | null
}

export type SystemInfo = {
  kernel: string
  selinux: string
  mountBase: string
  hymofsModules?: string[]
  hymofsMismatch?: boolean
  mismatchMessage?: string
}
