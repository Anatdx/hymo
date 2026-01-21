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

// Serialize config to JSON (handled natively)
// function serializeConfig(config: Config): string { ... } removed

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

  async getUserHideRules(): Promise<string[]> {
    return [
      '/data/adb/magisk',
      '/data/local/tmp/test_file',
    ]
  },

  async getAllHideRules(): Promise<Array<{ path: string; isUserDefined: boolean }>> {
    return [
      { path: '/data/adb/magisk', isUserDefined: true },
      { path: '/data/local/tmp/test_file', isUserDefined: true },
      { path: '/system/app/EdXposed', isUserDefined: false },
      { path: '/data/adb/modules/test/.hidden', isUserDefined: false },
    ]
  },

  async addUserHideRule(_path: string): Promise<void> {
    console.log('[Mock] Add hide rule:', _path)
  },

  async removeUserHideRule(_path: string): Promise<void> {
    console.log('[Mock] Remove hide rule:', _path)
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
    
    const data = JSON.stringify(config, null, 2).replace(/'/g, "'\\''")
    const cmd = `mkdir -p "$(dirname "${PATHS.CONFIG}")" && printf '%s\\n' '${data}' > "${PATHS.CONFIG}"`
    const { errno } = await ksuExec!(cmd)
    if (errno !== 0) throw new Error('Failed to save config')
    
    // Apply kernel settings
    await ksuExec!(`${PATHS.BINARY} debug ${config.enable_kernel_debug ? 'on' : 'off'}`)
    await ksuExec!(`${PATHS.BINARY} stealth ${config.enable_stealth ? 'on' : 'off'}`)
    if (config.hymofs_available) {
      await ksuExec!(`${PATHS.BINARY} hymofs ${config.hymofs_enabled ? 'on' : 'off'}`)
    }
    // Apply uname spoofing (always apply to ensure we can clear it)
    {
      const release = (config.uname_release || '').replace(/'/g, "'\\''")
      const version = (config.uname_version || '').replace(/'/g, "'\\''")
      await ksuExec!(`${PATHS.BINARY} set-uname '${release}' '${version}'`)
    }
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
    
    const modes: Record<string, string> = {}
    modules.forEach(m => {
      if (m.mode !== 'auto' && /^[a-zA-Z0-9_.-]+$/.test(m.id)) {
        modes[m.id] = m.mode
      }
    })
    
    const data = JSON.stringify(modes, null, 2).replace(/'/g, "'\\''")
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
    
    const rules: Record<string, Array<{path: string, mode: string}>> = {}
    modules.forEach(m => {
      if (m.rules?.length) {
        rules[m.id] = m.rules.map(r => ({path: r.path, mode: r.mode}))
      }
    })
    
    const data = JSON.stringify(rules, null, 2).replace(/'/g, "'\\''")
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

  async scanPartitionsFromModules(_moduledir: string): Promise<string[]> {
      await initKernelSU()
      if (!ksuExec) return []
      
      // Use hymod to scan for actual partition candidates
      // This checks module directories against system mountpoints
      const cmd = `${PATHS.BINARY} sync-partitions 2>&1`
      try {
        const { stdout } = await ksuExec!(cmd)
        const partitions = new Set<string>()
        
        // Parse output for "Added partition: <name>" or "No new partitions"
        const lines = stdout.split('\n')
        for (const line of lines) {
          const match = line.match(/Added partition:\s*(\S+)/)
          if (match) {
            partitions.add(match[1])
          }
        }
        
        return Array.from(partitions)
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
        
        // Handle "Not mounted" error or valid stats
        if (data.error) {
              return {
              size: '-',
              used: '-',
              avail: '-',
              percent: 0,
              mode: null,
            }
        }

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
      let unameRelease = ''
      let unameVersion = ''
      try {
        const { stdout } = await ksuExec!('uname -r')
        if (stdout) {
          kernel = stdout.trim()
          unameRelease = stdout.trim()
        }
      } catch (e) { console.warn('Failed to get kernel info', e) }

      try {
        const { stdout } = await ksuExec!('uname -v')
        if (stdout) unameVersion = stdout.trim()
      } catch (e) { console.warn('Failed to get kernel version', e) }

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
        console.log('[SystemInfo] version command output:', mountData)
      } catch (e) { 
        console.warn('Failed to get mount info', e) 
      }
      
      const result = {
        kernel,
        selinux,
        mountBase: mountData.mount_base || '/dev/hymo_mirror',
        unameRelease,
        unameVersion,
        hymofsModules: mountData.active_modules || [],
        hymofsMismatch: mountData.protocol_mismatch || false,
        mismatchMessage: mountData.mismatch_message,
      }
      console.log('[SystemInfo] Final result:', result)
      return result
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

  async getUserHideRules(): Promise<string[]> {
    await initKernelSU()
    if (!ksuExec) return []
    
    try {
      const cmd = `${PATHS.BINARY} hide list`
      const { errno, stdout } = await ksuExec!(cmd)
      
      if (errno === 0 && stdout) {
        try {
          const rules = JSON.parse(stdout)
          if (Array.isArray(rules)) {
            return rules
          }
        } catch (e) {
          // Fallback
          return stdout
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && line.startsWith('/'))
        }
      }
    } catch (e) {
      console.error('Failed to get user hide rules:', e)
    }
    return []
  },

  async getAllHideRules(): Promise<Array<{ path: string; isUserDefined: boolean }>> {
    await initKernelSU()
    if (!ksuExec) return []
    
    try {
      const [userRules, allOutput] = await Promise.all([
        this.getUserHideRules(),
        ksuExec!(`${PATHS.BINARY} list`)
      ])
      
      const userSet = new Set(userRules)
      const rules: Array<{ path: string; isUserDefined: boolean }> = []
      
      if (allOutput.errno === 0 && allOutput.stdout) {
        let parsed = false
        try {
          const data = JSON.parse(allOutput.stdout)
          if (Array.isArray(data)) {
            parsed = true
            data.forEach((rule: any) => {
              if (rule.type === 'HIDE' && rule.path) {
                rules.push({
                  path: rule.path,
                  isUserDefined: userSet.has(rule.path)
                })
              }
            })
          }
        } catch (e) {
          // JSON parse failed, fall through to legacy
        }

        if (!parsed) {
          // Parse "hide /path/to/file" lines
          const lines = allOutput.stdout.split('\n')
          for (const line of lines) {
            if (line.startsWith('hide ')) {
              const path = line.substring(5).trim()
              if (path) {
                rules.push({
                  path,
                  isUserDefined: userSet.has(path)
                })
              }
            }
          }
        }
      }
      
      return rules
    } catch (e) {
      console.error('Failed to get all hide rules:', e)
      return []
    }
  },

  async addUserHideRule(path: string): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const cmd = `${PATHS.BINARY} hide add "${path}"`
    const { errno, stderr } = await ksuExec!(cmd)
    if (errno !== 0) {
      throw new Error(stderr || 'Failed to add hide rule')
    }
  },

  async removeUserHideRule(path: string): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const cmd = `${PATHS.BINARY} hide remove "${path}"`
    const { errno, stderr } = await ksuExec!(cmd)
    if (errno !== 0) {
      throw new Error(stderr || 'Failed to remove hide rule')
    }
  },
}

export const api = shouldUseMock ? mockApi : realApi
