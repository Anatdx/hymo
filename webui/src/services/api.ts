import { PATHS, DEFAULT_CONFIG, type Config, type Module, type StorageInfo, type SystemInfo } from '@/types'

const isDev = import.meta.env.DEV
let ksuExec: ((cmd: string) => Promise<{ errno: number; stdout: string; stderr: string }>) | null = null

// Initialize KernelSU API
async function initKernelSU() {
  if (ksuExec !== null) return ksuExec
  
  try {
    const ksu = await import('kernelsu').catch(() => null)
    ksuExec = ksu ? ksu.exec : null
  } catch (e) {
    ksuExec = null
  }
  
  return ksuExec
}

const shouldUseMock = isDev

// Serialize config to TOML
function serializeConfig(config: Config): string {
  let output = '# Hymo Config\n'
  
  if (config.moduledir) output += `moduledir = "${config.moduledir}"\n`
  if (config.tempdir) output += `tempdir = "${config.tempdir}"\n`
  if (config.mountsource) output += `mountsource = "${config.mountsource}"\n`
  
  output += `verbose = ${config.verbose}\n`
  output += `force_ext4 = ${config.force_ext4}\n`
  output += `disable_umount = ${config.disable_umount}\n`
  output += `enable_nuke = ${config.enable_nuke}\n`
  output += `ignore_protocol_mismatch = ${config.ignore_protocol_mismatch}\n`
  output += `enable_kernel_debug = ${config.enable_kernel_debug}\n`
  output += `enable_stealth = ${config.enable_stealth}\n`
  
  if (config.partitions?.length) {
    output += `partitions = "${config.partitions.join(',')}"\n`
  } else {
    output += `partitions = ""\n`
  }
  
  return output
}

const mockApi = {
  async loadConfig(): Promise<Config> {
    return { ...DEFAULT_CONFIG, partitions: ['system', 'vendor'] }
  },

  async saveConfig(_config: Config): Promise<void> {
    console.log('[Mock] Config saved')
  },

  async scanModules(): Promise<Module[]> {
    return [
      {
        id: 'example_module',
        name: 'Example Module',
        version: '1.0.0',
        author: 'Developer',
        description: 'A demo module for testing',
        mode: 'auto',
        strategy: 'overlay',
        path: '/data/adb/modules/example_module',
        rules: [],
      },
    ]
  },

  async saveModules(_modules: Module[]): Promise<void> {
    console.log('[Mock] Modules saved')
  },

  async checkConflicts(): Promise<any[]> {
    return []
  },

  async saveRules(_modules: Module[]): Promise<void> {
    console.log('[Mock] Rules saved')
  },

  async syncPartitions(): Promise<string> {
    return 'Sync completed (mock)'
  },
  
  async scanPartitionsFromModules(_moduledir: string): Promise<string[]> {
      return ['system', 'product', 'my_custom_partition']
  },

  async readLogs(_logPath: string, _lines?: number): Promise<string> {
    return 'Sample log line 1\nSample log line 2\nSample log line 3'
  },

  async getStorageUsage(): Promise<StorageInfo> {
    return {
      size: '512M',
      used: '128M',
      avail: '384M',
      percent: 25,
      mode: 'tmpfs',
    }
  },

  async getSystemInfo(): Promise<SystemInfo> {
    return {
      kernel: '5.15.0-hymo',
      selinux: 'Permissive',
      mountBase: '/dev/hymofs',
      hymofsModules: ['example_module'],
      hymofsMismatch: false,
    }
  },

  async hotMount(_moduleId: string): Promise<void> {
    console.log('[Mock] Hot mount')
  },

  async hotUnmount(_moduleId: string): Promise<void> {
    console.log('[Mock] Hot unmount')
  },
}

const realApi = {
  async loadConfig(): Promise<Config> {
    await initKernelSU()
    if (!ksuExec) return DEFAULT_CONFIG
    
    const cmd = `${PATHS.BINARY} show-config`
    try {
      const { errno, stdout } = await ksuExec!(cmd)
      if (errno === 0 && stdout) {
        return JSON.parse(stdout)
      }
      return DEFAULT_CONFIG
    } catch (e) {
      console.error('Failed to load config:', e)
      return DEFAULT_CONFIG
    }
  },

  async saveConfig(config: Config): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const data = serializeConfig(config).replace(/'/g, "'\\''")
    const cmd = `mkdir -p "$(dirname "${PATHS.CONFIG}")" && printf '%s\\n' '${data}' > "${PATHS.CONFIG}"`
    const { errno } = await ksuExec!(cmd)
    if (errno !== 0) throw new Error('Failed to save config')
    
    // Apply kernel settings
    await ksuExec!(`${PATHS.BINARY} debug ${config.enable_kernel_debug ? 'on' : 'off'}`)
    await ksuExec!(`${PATHS.BINARY} stealth ${config.enable_stealth ? 'on' : 'off'}`)
  },

  async scanModules(): Promise<Module[]> {
    await initKernelSU()
    if (!ksuExec) return []
    
    const cmd = `${PATHS.BINARY} modules`
    try {
      const { errno, stdout } = await ksuExec!(cmd)
      if (errno === 0 && stdout) {
        const data = JSON.parse(stdout)
        const modules = data.modules || data || []
        return modules.map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          version: m.version || '',
          author: m.author || '',
          description: m.description || '',
          mode: m.mode || 'auto',
          strategy: m.strategy || 'overlay',
          path: m.path,
          rules: m.rules || [],
        }))
      }
    } catch (e) {
      console.error('Module scan failed:', e)
    }
    return []
  },

  async saveModules(modules: Module[]): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    let content = '# Module Modes\n'
    modules.forEach(m => {
      if (m.mode !== 'auto' && /^[a-zA-Z0-9_.-]+$/.test(m.id)) {
        content += `${m.id}=${m.mode}\n`
      }
    })
    
    const data = content.replace(/'/g, "'\\''")
    const cmd = `mkdir -p "$(dirname "${PATHS.MODE_CONFIG}")" && printf '%s\\n' '${data}' > "${PATHS.MODE_CONFIG}"`
    const { errno } = await ksuExec!(cmd)
    if (errno !== 0) throw new Error('Failed to save modes')
  },

  async checkConflicts(): Promise<any[]> {
    await initKernelSU()
    if (!ksuExec) return []
    
    const cmd = `${PATHS.BINARY} check-conflicts`
    try {
      const { errno, stdout } = await ksuExec!(cmd)
      if (errno === 0 && stdout) {
        return JSON.parse(stdout)
      }
    } catch (e) {
      console.error('Check conflicts failed:', e)
    }
    return []
  },

  async saveRules(modules: Module[]): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    let content = '# Module Rules\n'
    modules.forEach(m => {
      if (m.rules?.length) {
        m.rules.forEach(r => {
          content += `${m.id}:${r.path}=${r.mode}\n`
        })
      }
    })
    
    const data = content.replace(/'/g, "'\\''")
    const cmd = `mkdir -p "$(dirname "${PATHS.RULES_CONFIG}")" && printf '%s\\n' '${data}' > "${PATHS.RULES_CONFIG}"`
    const { errno } = await ksuExec!(cmd)
    if (errno !== 0) throw new Error('Failed to save rules')
  },

  async syncPartitions(): Promise<string> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const cmd = `${PATHS.BINARY} sync-partitions`
    const { errno, stdout } = await ksuExec!(cmd)
    if (errno === 0) return stdout
    throw new Error('Sync failed')
  },

  async scanPartitionsFromModules(moduledir: string): Promise<string[]> {
      await initKernelSU()
      if (!ksuExec) return []
      
      // Find all 2nd level directories in module dir
      const cmd = `find ${moduledir} -mindepth 2 -maxdepth 2 -type d`
      try {
        const { errno, stdout } = await ksuExec!(cmd)
        if (errno === 0 && stdout) {
            const paths = stdout.split('\n').filter(Boolean)
            const partitions = new Set<string>()
            for (const p of paths) {
                const parts = p.split('/')
                const name = parts[parts.length - 1]
                // Filter out common non-partition folders if any?
                // For now, accept everything that's not hidden
                if (!name.startsWith('.')) {
                    partitions.add(name)
                }
            }
            return Array.from(partitions)
        }
      } catch(e) {
          console.error("Failed to scan partitions", e)
      }
      return []
  },

  async readLogs(logPath: string, lines = 1000): Promise<string> {
    await initKernelSU()
    if (!ksuExec) return ''
    
    if (logPath === 'kernel') {
      const cmd = `dmesg | grep -i hymofs | tail -n ${lines}`
      const { stdout } = await ksuExec!(cmd)
      return stdout || ''
    }

    const f = logPath || DEFAULT_CONFIG.logfile
    const cmd = `[ -f "${f}" ] && tail -n ${lines} "${f}" || echo ""`
    const { errno, stdout, stderr } = await ksuExec!(cmd)
    
    if (errno === 0) return stdout || ''
    throw new Error(stderr || 'Log file not found')
  },

  async getStorageUsage(): Promise<StorageInfo> {
    await initKernelSU()
    if (!ksuExec) return { size: '-', used: '-', avail: '-', percent: 0, mode: null }
    
    try {
      const cmd = `${PATHS.BINARY} storage`
      const { errno, stdout } = await ksuExec!(cmd)
      
      if (errno === 0 && stdout) {
        const data = JSON.parse(stdout)
        return {
          size: data.size || '-',
          used: data.used || '-',
          avail: data.avail || '-',
          percent: typeof data.percent === 'number' ? data.percent : 0,
          mode: data.mode || null,
        }
      }
    } catch (e) {
      console.error('Storage check failed:', e)
    }
    return { size: '-', used: '-', avail: '-', percent: 0, mode: null }
  },

  async getSystemInfo(): Promise<SystemInfo> {
    await initKernelSU()
    if (!ksuExec) {
      return {
        kernel: 'Unknown',
        selinux: 'Unknown',
        mountBase: '/dev/null',
      }
    }
    
    try {
      // Fetch kernel version
      let kernel = 'Unknown'
      try {
        const { stdout } = await ksuExec!('uname -r')
        if (stdout) kernel = stdout.trim()
      } catch (e) { console.warn('Failed to get kernel info', e) }

      // Fetch SELinux status
      let selinux = 'Unknown'
      try {
         const { stdout } = await ksuExec!('getenforce')
         if (stdout) selinux = stdout.trim()
      } catch (e) { console.warn('Failed to get selinux info', e) }
      
      const cmdMount = `${PATHS.BINARY} version`
      let mountData: any = {}
      try {
        const { stdout: outMount } = await ksuExec!(cmdMount)
        mountData = JSON.parse(outMount || '{}')
      } catch (e) { console.warn('Failed to get mount info', e) }
      
      return {
        kernel,
        selinux,
        mountBase: mountData.mount_base || '/dev/hymo_mirror',
        hymofsModules: mountData.active_modules || [],
        hymofsMismatch: mountData.protocol_mismatch || false,
        mismatchMessage: mountData.mismatch_message,
      }
    } catch (e) {
      console.error('System info check failed:', e)
      return {
        kernel: 'Unknown',
        selinux: 'Unknown',
        mountBase: '/dev/hymo_mirror',
      }
    }
  },

  async hotMount(moduleId: string): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const cmd = `${PATHS.BINARY} add "${moduleId}"`
    const { errno } = await ksuExec!(cmd)
    if (errno !== 0) throw new Error('Hot mount failed')
  },

  async hotUnmount(moduleId: string): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const cmd = `${PATHS.BINARY} delete "${moduleId}"`
    const { errno } = await ksuExec!(cmd)
    if (errno !== 0) throw new Error('Hot unmount failed')
  },
}

export const api = shouldUseMock ? mockApi : realApi
