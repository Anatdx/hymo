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
    return { ...DEFAULT_CONFIG, partitions: ['system', 'vendor'], hymofs_available: true }
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

  async clearLogs(): Promise<void> {
    console.log('[Mock] Logs cleared')
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
      hooks: 'GET_FD: tracepoint (sys_enter/sys_exit)\npath: tracepoint (sys_enter)\nvfs_getattr,d_path,iterate_dir,vfs_getxattr: ftrace+kretprobe\nuname: kretprobe\ncmdline: tracepoint (sys_enter/sys_exit)',
      mountStats: {
        total_mounts: 45,
        successful_mounts: 44,
        failed_mounts: 1,
        tmpfs_created: 3,
        files_mounted: 20,
        dirs_mounted: 15,
        symlinks_created: 10,
        overlayfs_mounts: 0,
        success_rate: 97.8,
      },
      detectedPartitions: [
        { name: 'system', mount_point: '/system', fs_type: 'ext4', is_read_only: true, exists_as_symlink: false },
        { name: 'vendor', mount_point: '/vendor', fs_type: 'ext4', is_read_only: true, exists_as_symlink: true },
        { name: 'product', mount_point: '/product', fs_type: 'ext4', is_read_only: true, exists_as_symlink: true },
        { name: 'odm', mount_point: '/odm', fs_type: 'ext4', is_read_only: true, exists_as_symlink: false },
      ],
    }
  },

  async getUserHideRules(): Promise<string[]> {
    return [
      '/data/adb/magisk',
      '/data/local/tmp/test_file',
    ]
  },

  async getAllRules(): Promise<Array<{ type: string; path: string; target?: string; source?: string; isUserDefined: boolean }>> {
    return [
      { type: 'SPOOF', path: 'uname', target: '5.10.0', isUserDefined: false },
      { type: 'SPOOF', path: 'uname', target: '#1 SMP', isUserDefined: false },
      { type: 'HIDE', path: '/data/adb/magisk', isUserDefined: true },
      { type: 'HIDE', path: '/data/local/tmp/test_file', isUserDefined: true },
      { type: 'HIDE', path: '/system/app/EdXposed', isUserDefined: false },
      { type: 'HIDE', path: '/data/adb/modules/test/.hidden', isUserDefined: false },
      { type: 'MERGE', path: '/system/app', source: '/data/adb/modules/foo/system/app', isUserDefined: false },
    ]
  },

  async addUserHideRule(_path: string): Promise<void> {
    console.log('[Mock] Add hide rule:', _path)
  },

  async removeUserHideRule(_path: string): Promise<void> {
    console.log('[Mock] Remove hide rule:', _path)
  },

  async getLkmStatus(): Promise<{ loaded: boolean; autoload: boolean }> {
    return { loaded: true, autoload: true }
  },

  async lkmLoad(): Promise<void> {
    console.log('[Mock] LKM load')
  },

  async lkmUnload(): Promise<void> {
    console.log('[Mock] LKM unload')
  },

  async lkmSetAutoload(_on: boolean): Promise<void> {
    console.log('[Mock] LKM set autoload')
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
    
    const cmd = `${PATHS.BINARY} config show`
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
    
    // Only save persistent config fields, exclude runtime status fields
    const configToSave = {
      moduledir: config.moduledir,
      tempdir: config.tempdir,
      mountsource: config.mountsource,
      debug: config.debug,
      verbose: config.verbose,
      fs_type: config.fs_type,
      disable_umount: config.disable_umount,
      enable_nuke: config.enable_nuke,
      ignore_protocol_mismatch: config.ignore_protocol_mismatch,
      enable_kernel_debug: config.enable_kernel_debug,
      enable_stealth: config.enable_stealth,
      hymofs_enabled: config.hymofs_enabled,
      uname_release: config.uname_release,
      uname_version: config.uname_version,
      mount_stage: config.mount_stage,
      partitions: config.partitions,
    }
    const data = JSON.stringify(configToSave, null, 2).replace(/'/g, "'\\''")
    const cmd = `mkdir -p "$(dirname "${PATHS.CONFIG}")" && printf '%s\\n' '${data}' > "${PATHS.CONFIG}"`
    const { errno } = await ksuExec!(cmd)
    if (errno !== 0) throw new Error('Failed to save config')
    
    // Apply kernel settings
    await ksuExec!(`${PATHS.BINARY} debug ${config.enable_kernel_debug ? 'enable' : 'disable'}`)
    await ksuExec!(`${PATHS.BINARY} debug stealth ${config.enable_stealth ? 'enable' : 'disable'}`)
    if (config.hymofs_available) {
      await ksuExec!(`${PATHS.BINARY} hymofs ${config.hymofs_enabled ? 'enable' : 'disable'}`)
    }
    // Apply uname spoofing (always apply to ensure we can clear it)
    {
      const release = (config.uname_release || '').replace(/'/g, "'\\''")
      const version = (config.uname_version || '').replace(/'/g, "'\\''")
      await ksuExec!(`${PATHS.BINARY} debug set-uname '${release}' '${version}'`)
    }
  },

  async scanModules(): Promise<Module[]> {
    await initKernelSU()
    if (!ksuExec) return []
    
    const cmd = `${PATHS.BINARY} module list`
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
    
    const cmd = `${PATHS.BINARY} module check-conflicts`
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
    
    const cmd = `${PATHS.BINARY} config sync-partitions`
    const { errno, stdout } = await ksuExec!(cmd)
    if (errno === 0) return stdout
    throw new Error('Sync failed')
  },

  async scanPartitionsFromModules(_moduledir: string): Promise<string[]> {
      await initKernelSU()
      if (!ksuExec) return []
      
      // Use hymod to scan for actual partition candidates
      // This checks module directories against system mountpoints
      const cmd = `${PATHS.BINARY} config sync-partitions 2>&1`
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
      const cmd = `${PATHS.BINARY} api storage`
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
      // Fetch kernel version from /proc/version to get real system values (not spoofed by HymoFS)
      let kernel = 'Unknown'
      let unameRelease = ''
      let unameVersion = ''
      try {
        const { stdout } = await ksuExec!('cat /proc/version')
        if (stdout) {
          // Extract just the kernel version number from /proc/version
          // Format: "Linux version 5.15.0-generic (...)"
          const releaseMatch = stdout.match(/Linux version ([^\s]+)/)
          if (releaseMatch) {
            kernel = releaseMatch[1]  // Just the version number
            unameRelease = releaseMatch[1]
          } else {
            kernel = stdout.trim()
          }
          // Extract version string (everything after the release), then drop leading build host/toolchain info
          const versionMatch = stdout.match(/Linux version [^\s]+ (.+)/)
          if (versionMatch) {
            let fullVersion = versionMatch[1].trim()
            // Remove leading parenthetical groups like "(user@host)" "(gcc version ...)"
            while (fullVersion.startsWith('(')) {
              const end = fullVersion.indexOf(')')
              if (end === -1) break
              fullVersion = fullVersion.substring(end + 1).trim()
            }
            // If toolchain/host info still exists, keep from the first '#'
            const hashIndex = fullVersion.indexOf('#')
            if (hashIndex > 0) {
              fullVersion = fullVersion.substring(hashIndex).trim()
            }
            unameVersion = fullVersion
          }
        }
      } catch (e) { console.warn('Failed to get kernel info from /proc/version', e) }

      // Fetch SELinux status
      let selinux = 'Unknown'
      try {
         const { stdout } = await ksuExec!('getenforce')
         if (stdout) selinux = stdout.trim()
      } catch (e) { console.warn('Failed to get selinux info', e) }
      
      // Use 'api system' to get complete system info including mount stats
      const cmdSystem = `${PATHS.BINARY} api system`
      let systemData: any = {}
      try {
        const { stdout: outSystem } = await ksuExec!(cmdSystem)
        systemData = JSON.parse(outSystem || '{}')
        console.log('[SystemInfo] api system output:', systemData)
      } catch (e) { 
        console.warn('Failed to get system info', e) 
      }
      
      // Also get hymofs version for active modules and mismatch info
      const cmdMount = `${PATHS.BINARY} hymofs version`
      let mountData: any = {}
      try {
        const { stdout: outMount } = await ksuExec!(cmdMount)
        mountData = JSON.parse(outMount || '{}')
        console.log('[SystemInfo] hymofs version output:', mountData)
      } catch (e) { 
        console.warn('Failed to get mount info', e) 
      }
      
      const result = {
        kernel,
        selinux,
        mountBase: systemData.mount_base || mountData.mount_base || '/dev/hymo_mirror',
        unameRelease,
        unameVersion,
        hymofsModules: mountData.active_modules || [],
        hymofsMismatch: mountData.protocol_mismatch || false,
        mismatchMessage: mountData.mismatch_message,
        hooks: mountData.hooks || '',
        mountStats: systemData.mountStats,
        detectedPartitions: systemData.detectedPartitions,
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
    
    const cmd = `${PATHS.BINARY} module hot-mount "${moduleId}"`
    const { errno } = await ksuExec!(cmd)
    if (errno !== 0) throw new Error('Hot mount failed')
  },

  async hotUnmount(moduleId: string): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const cmd = `${PATHS.BINARY} module hot-unmount "${moduleId}"`
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

  async getAllRules(): Promise<Array<{ type: string; path: string; target?: string; source?: string; isUserDefined: boolean }>> {
    await initKernelSU()
    if (!ksuExec) return []
    
    try {
      const [userRules, allOutput] = await Promise.all([
        this.getUserHideRules(),
        ksuExec!(`${PATHS.BINARY} hymofs list`)
      ])
      
      const userSet = new Set(userRules)
      const rules: Array<{ type: string; path: string; target?: string; source?: string; isUserDefined: boolean }> = []
      
      if (allOutput.errno === 0 && allOutput.stdout) {
        let parsed = false
        try {
          const data = JSON.parse(allOutput.stdout)
          if (Array.isArray(data)) {
            parsed = true
            data.forEach((rule: any) => {
              if (rule.type === 'INJECT') return
              const path = rule.path ?? rule.target ?? ''
              rules.push({
                type: rule.type || 'UNKNOWN',
                path,
                target: rule.target,
                source: rule.source,
                isUserDefined: rule.type === 'HIDE' && path && userSet.has(path)
              })
            })
          }
        } catch (e) {
          // JSON parse failed, fall through to legacy
        }

        if (!parsed) {
          // Parse legacy format (line-based)
          const lines = allOutput.stdout.split('\n')
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            if (trimmed.startsWith('hide ')) {
              const path = trimmed.substring(5).trim()
              if (path) {
                rules.push({
                  type: 'HIDE',
                  path,
                  isUserDefined: userSet.has(path)
                })
              }
            } else {
              const parts = trimmed.split(/\s+/)
              if (parts.length >= 2) {
                const type = parts[0].toUpperCase()
                if (type === 'INJECT') continue
                if (type === 'MERGE' || type === 'ADD') {
                  rules.push({
                    type,
                    path: parts[1] ?? '',
                    source: parts[2],
                    isUserDefined: false
                  })
                } else {
                  rules.push({
                    type,
                    path: parts.slice(1).join(' '),
                    isUserDefined: false
                  })
                }
              }
            }
          }
        }
      }
      
      return rules
    } catch (e) {
      console.error('Failed to get all rules:', e)
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

  async getLkmStatus(): Promise<{ loaded: boolean; autoload: boolean }> {
    await initKernelSU()
    if (!ksuExec) return { loaded: false, autoload: true }
    
    try {
      const cmd = `${PATHS.BINARY} api lkm`
      const { errno, stdout } = await ksuExec!(cmd)
      if (errno === 0 && stdout) {
        const data = JSON.parse(stdout)
        return {
          loaded: data.loaded === true,
          autoload: data.autoload !== false,
        }
      }
    } catch (e) {
      console.error('Failed to get LKM status:', e)
    }
    return { loaded: false, autoload: true }
  },

  async lkmLoad(): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const cmd = `${PATHS.BINARY} lkm load`
    const { errno, stderr } = await ksuExec!(cmd)
    if (errno !== 0) {
      throw new Error(stderr || 'Failed to load LKM')
    }
  },

  async lkmUnload(): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const cmd = `${PATHS.BINARY} lkm unload`
    const { errno, stderr } = await ksuExec!(cmd)
    if (errno !== 0) {
      throw new Error(stderr || 'Failed to unload LKM')
    }
  },

  async lkmSetAutoload(on: boolean): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    const cmd = `${PATHS.BINARY} lkm set-autoload ${on ? 'on' : 'off'}`
    const { errno, stderr } = await ksuExec!(cmd)
    if (errno !== 0) {
      throw new Error(stderr || 'Failed to set LKM autoload')
    }
  },

  async clearLogs(): Promise<void> {
    await initKernelSU()
    if (!ksuExec) throw new Error('KernelSU not available')
    
    // Clear daemon log file
    const cmd = `echo -n > /data/adb/hymo/daemon.log`
    const { errno, stderr } = await ksuExec!(cmd)
    if (errno !== 0) {
      throw new Error(stderr || 'Failed to clear logs')
    }
  },
}

export const api = shouldUseMock ? mockApi : realApi
