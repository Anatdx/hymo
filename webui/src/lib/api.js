import { DEFAULT_CONFIG, PATHS } from './constants';
import { MockAPI } from './api.mock';

let ksuExec;
try {
  const ksu = await import('kernelsu').catch(() => null);
  ksuExec = ksu ? ksu.exec : null;
} catch (e) {
  console.warn("KernelSU module not found, defaulting to Mock/Fallback.");
}

const shouldUseMock = import.meta.env.DEV || !ksuExec;

console.log(`[API Init] Mode: ${shouldUseMock ? '🛠️ MOCK (Dev/Browser)' : '🚀 REAL (Device)'}`);

function serializeKvConfig(config) {
  let output = "# Hymo Configuration\n";
  
  if (config.moduledir) output += `moduledir = "${config.moduledir}"\n`;
  if (config.tempdir) output += `tempdir = "${config.tempdir}"\n`;
  if (config.mountsource) output += `mountsource = "${config.mountsource}"\n`;
  
  output += `verbose = ${config.verbose ? 'true' : 'false'}\n`;
  output += `force_ext4 = ${config.force_ext4 ? 'true' : 'false'}\n`;
  output += `disable_umount = ${config.disable_umount ? 'true' : 'false'}\n`;
  output += `enable_nuke = ${config.enable_nuke ? 'true' : 'false'}\n`;
  output += `ignore_protocol_mismatch = ${config.ignore_protocol_mismatch ? 'true' : 'false'}\n`;
  output += `enable_kernel_debug = ${config.enable_kernel_debug ? 'true' : 'false'}\n`;
  output += `enable_stealth = ${config.enable_stealth ? 'true' : 'false'}\n`;
  
  if (config.partitions && Array.isArray(config.partitions)) {
    output += `partitions = "${config.partitions.join(',')}"\n`;
  } else {
    output += `partitions = ""\n`;
  }
  
  return output;
}

const RealAPI = {
  loadConfig: async () => {
    // Use centralized binary path
    const cmd = `${PATHS.BINARY} show-config`;
    try {
      const { errno, stdout } = await ksuExec(cmd);
      if (errno === 0 && stdout) {
        return JSON.parse(stdout);
      } else {
        console.warn("Config load returned non-zero or empty, using defaults");
        return DEFAULT_CONFIG;
      }
    } catch (e) {
      console.error("Failed to load config from backend:", e);
      return DEFAULT_CONFIG; 
    }
  },

  saveConfig: async (config) => {
    const data = serializeKvConfig(config).replace(/'/g, "'\\''");
    const cmd = `mkdir -p "$(dirname "${PATHS.CONFIG}")" && printf '%s\n' '${data}' > "${PATHS.CONFIG}"`;
    const { errno } = await ksuExec(cmd);
    if (errno !== 0) throw new Error('Failed to save config');
  },

  scanModules: async () => {
    const cmd = `${PATHS.BINARY} modules`;
    try {
      const { errno, stdout } = await ksuExec(cmd);
      if (errno === 0 && stdout) {
        const data = JSON.parse(stdout);
        // C++ backend returns { count, modules: [...] }
        // Extract the modules array and add missing 'name' field
        const modules = data.modules || data || [];
        return modules.map(m => ({
          id: m.id,
          name: m.name || m.id,
          version: m.version || '',
          author: m.author || '',
          description: m.description || '',
          mode: m.mode || 'auto',
          strategy: m.strategy || 'overlay',
          path: m.path,
          rules: m.rules || []
        }));
      }
    } catch (e) {
      console.error("Module scan failed:", e);
    }
    return [];
  },

  saveModules: async (modules) => {
    let content = "# Module Modes\n";
    modules.forEach(m => { 
      if (m.mode !== 'auto' && /^[a-zA-Z0-9_.-]+$/.test(m.id)) {
        content += `${m.id}=${m.mode}\n`; 
      }
    });
    
    const data = content.replace(/'/g, "'\\''");
    const { errno } = await ksuExec(`mkdir -p "$(dirname "${PATHS.MODE_CONFIG}")" && printf '%s\n' '${data}' > "${PATHS.MODE_CONFIG}"`);
    if (errno !== 0) throw new Error('Failed to save modes');
  },

  saveRules: async (modules) => {
    let content = "# Module Rules\n";
    modules.forEach(m => {
      if (m.rules && m.rules.length > 0) {
        m.rules.forEach(r => {
            content += `${m.id}:${r.path}=${r.mode}\n`;
        });
      }
    });
    
    const data = content.replace(/'/g, "'\\''");
    const { errno } = await ksuExec(`mkdir -p "$(dirname "${PATHS.RULES_CONFIG}")" && printf '%s\n' '${data}' > "${PATHS.RULES_CONFIG}"`);
    if (errno !== 0) throw new Error('Failed to save rules');
  },

  syncPartitions: async () => {
    const cmd = `${PATHS.BINARY} sync-partitions`;
    try {
      const { errno, stdout } = await ksuExec(cmd);
      if (errno === 0) {
        return stdout;
      } else {
        throw new Error("Sync failed");
      }
    } catch (e) {
      console.error("Sync partitions failed:", e);
      throw e;
    }
  },

  readLogs: async (logPath, lines = 1000) => {
    if (logPath === 'kernel') {
      const cmd = `dmesg | grep -i hymofs | tail -n ${lines}`;
      const { errno, stdout } = await ksuExec(cmd);
      // dmesg might return 1 if grep finds nothing, which is fine
      return stdout || "";
    }

    const f = logPath || DEFAULT_CONFIG.logfile;
    const cmd = `[ -f "${f}" ] && tail -n ${lines} "${f}" || echo ""`;
    const { errno, stdout, stderr } = await ksuExec(cmd);
    
    if (errno === 0) return stdout || "";
    throw new Error(stderr || "Log file not found or unreadable");
  },

  getStorageUsage: async () => {
    try {
      const cmd = `${PATHS.BINARY} storage`;
      const { errno, stdout } = await ksuExec(cmd);
      
      if (errno === 0 && stdout) {
        const data = JSON.parse(stdout);
        // Backend now returns the definitive type from the state file
        return {
          size: data.size || '-',
          used: data.used || '-',
          avail: data.avail || '-', 
          percent: data.percent || '0%',
          type: data.type || null
        };
      }
    } catch (e) {
      console.error("Storage check failed:", e);
    }
    return { size: '-', used: '-', percent: '0%', type: null };
  },

  getSystemInfo: async () => {
    try {
      // 1. Get static kernel/selinux info
      const cmdSys = `echo "KERNEL:$(uname -r)"; echo "SELINUX:$(getenforce)"`;
      const { errno: errSys, stdout: outSys } = await ksuExec(cmdSys);
      
      let info = { kernel: '-', selinux: '-', mountBase: '-', activeMounts: [] };
      if (errSys === 0 && outSys) {
        outSys.split('\n').forEach(line => {
          if (line.startsWith('KERNEL:')) info.kernel = line.substring(7).trim();
          else if (line.startsWith('SELINUX:')) info.selinux = line.substring(8).trim();
        });
      }

      const stateFile = PATHS.DAEMON_STATE || "/data/adb/hymo/run/daemon_state.json";
      const cmdState = `cat "${stateFile}"`;
      const { errno: errState, stdout: outState } = await ksuExec(cmdState);
      
      if (errState === 0 && outState) {
        try {
          const state = JSON.parse(outState);
          info.mountBase = state.mount_point || 'Unknown';
          if (Array.isArray(state.active_mounts)) {
            info.activeMounts = state.active_mounts;
          }
          if (Array.isArray(state.hymofs_module_ids)) {
            info.hymofsModules = state.hymofs_module_ids;
          }
          if (state.hymofs_mismatch) {
            info.hymofsMismatch = true;
            info.mismatchMessage = state.mismatch_message || "Protocol mismatch detected";
          }
        } catch (e) {
          console.error("Failed to parse daemon state JSON", e);
        }
      }

      return info;
    } catch (e) {
      console.error("System info check failed:", e);
      return { kernel: 'Unknown', selinux: 'Unknown', mountBase: 'Unknown', activeMounts: [] };
    }
  },

  // Check active mounts filtered by mount source name
  getActiveMounts: async (sourceName) => {
    try {
      // 'mount' command lists all mounts. We grep for our source name.
      const src = sourceName || DEFAULT_CONFIG.mountsource;
      const cmd = `mount | grep "${src}"`; 
      const { errno, stdout } = await ksuExec(cmd);
      
      const mountedParts = [];
      if (errno === 0 && stdout) {
        stdout.split('\n').forEach(line => {
          // Line format example: "KSU on /system type overlay ..."
          const parts = line.split(' ');
          if (parts.length >= 3 && parts[2].startsWith('/')) {
            const partName = parts[2].substring(1);
            if (partName) mountedParts.push(partName);
          }
        });
      }
      return mountedParts;
    } catch (e) {
      console.error("Mount check failed:", e);
      return [];
    }
  },

  openLink: async (url) => {
    const safeUrl = url.replace(/"/g, '\\"');
    const cmd = `am start -a android.intent.action.VIEW -d "${safeUrl}"`;
    await ksuExec(cmd);
  },

  getVersion: async () => {
    try {
      const cmd = `grep "^version=" "$(dirname "${PATHS.BINARY}")/module.prop" | cut -d= -f2`;
      const { errno, stdout } = await ksuExec(cmd);
      if (errno === 0 && stdout) {
        return stdout.trim();
      }
    } catch (e) {
      console.error("Failed to get version:", e);
    }
    return "Unknown";
  },

  hotMount: async (moduleId) => {
    const cmd = `sh ${PATHS.MODULE_ROOT}/hot_mount.sh "${moduleId}"`;
    await ksuExec(cmd);
  },

  hotUnmount: async (moduleId) => {
    const cmd = `sh ${PATHS.MODULE_ROOT}/hot_unmount.sh "${moduleId}"`;
    await ksuExec(cmd);
  },

  fetchSystemColor: async () => {
    try {
      const { stdout } = await ksuExec('settings get secure theme_customization_overlay_packages');
      if (stdout) {
        const match = /["']?android\.theme\.customization\.system_palette["']?\s*:\s*["']?#?([0-9a-fA-F]{6,8})["']?/i.exec(stdout) || 
                      /["']?source_color["']?\s*:\s*["']?#?([0-9a-fA-F]{6,8})["']?/i.exec(stdout);
        if (match && match[1]) {
          let hex = match[1];
          if (hex.length === 8) hex = hex.substring(2);
          return '#' + hex;
        }
      }
    } catch (e) {}
    return null;
  },

  listFiles: async (path) => {
    try {
      // ls -p adds / to directories
      const cmd = `ls -1p "${path}"`;
      const { errno, stdout } = await ksuExec(cmd);
      if (errno === 0 && stdout) {
        return stdout.split('\n').filter(Boolean).map(name => ({
          name: name.replace(/\/$/, ''),
          isDir: name.endsWith('/'),
          path: path.replace(/\/$/, '') + '/' + name.replace(/\/$/, '')
        }));
      }
    } catch (e) {
      console.error("List files failed:", e);
    }
    return [];
  },

  readFileBase64: async (path) => {
    try {
      // Use base64 command to read file
      const cmd = `cat "${path}" | base64 -w 0`;
      const { errno, stdout } = await ksuExec(cmd);
      if (errno === 0 && stdout) {
        return stdout.trim();
      }
    } catch (e) {
      console.error("Read file failed:", e);
    }
    return null;
  }
};

export const API = shouldUseMock ? MockAPI : RealAPI;