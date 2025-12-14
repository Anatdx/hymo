import { API } from './api';
import { DEFAULT_CONFIG, DEFAULT_SEED } from './constants';
import { Monet } from './theme';

const localeModules = import.meta.glob('../locales/*.json', { eager: true });

// Global state using Svelte 5 Runes
export const store = $state({
  config: { ...DEFAULT_CONFIG },
  modules: [],
  logs: [],
  storage: { used: '-', size: '-', percent: '0%' },
  systemInfo: { kernel: '-', selinux: '-', mountBase: '-' },
  version: '', // App version from module.prop
  activePartitions: [], // List of currently mounted partitions
  activeHymoModules: [], // List of modules currently mounted via HymoFS
  logSource: 'daemon', // 'daemon' | 'kernel'

  // UI State
  loading: { config: false, modules: false, logs: false, status: false },
  saving: { config: false, modules: false },
  toast: { text: '', type: 'info', visible: false },
  
  // Settings
  theme: 'auto', // 'auto' | 'light' | 'dark'
  backgroundImage: '',
  uiOpacity: 1.0,
  isSystemDark: false,
  lang: 'en',
  showAdvanced: false, // Advanced options toggle
  seed: DEFAULT_SEED,
  loadedLocale: null, // Stores the content of the loaded JSON

  // Computed: Available languages list for UI
  get availableLanguages() {
    return Object.entries(localeModules).map(([path, mod]) => {
      const match = path.match(/\/([^/]+)\.json$/);
      const code = match ? match[1] : 'en';
      const name = mod.default?.lang?.display || code.toUpperCase();
      return { code, name };
    }).sort((a, b) => {
      if (a.code === 'en') return -1;
      if (b.code === 'en') return 1;
      return a.code.localeCompare(b.code);
    });
  },

  // Getters
  get L() {
    return this.loadedLocale || this.getFallbackLocale();
  },

  // Helper for initial safe state
  getFallbackLocale() {
    return {
        common: { appName: "Hymo UI", saving: "...", theme: "Theme", language: "Language", themeAuto: "Auto", themeLight: "Light", themeDark: "Dark" },
        lang: { display: "English" },
        tabs: { status: "Status", config: "Config", modules: "Modules", logs: "Logs", info: "Info" },
        status: { storageTitle: "Storage", storageDesc: "", moduleTitle: "Modules", moduleActive: "Active", modeStats: "Stats", modeAuto: "Auto", modeMagic: "Magic", sysInfoTitle: "System Info", kernel: "Kernel", selinux: "SELinux", mountBase: "Mount Base", activePartitions: "Active Partitions", notSupported: "❌" },
        config: { title: "Config", verboseLabel: "Verbose", verboseOff: "Off", verboseOn: "On", forceExt4: "Force Ext4", enableNuke: "Nuke LKM", disableUmount: "Disable Umount", ignoreProtocolMismatch: "Ignore HymoFS Version Mismatch", enableKernelDebug: "Enable Kernel Debug Logging", enableStealth: "Enable Stealth Mode", showAdvanced: "Show Advanced Options", moduleDir: "Dir", tempDir: "Temp", mountSource: "Source", logFile: "Log", partitions: "Partitions", autoPlaceholder: "Auto", reload: "Reload", save: "Save", reset: "Reset to Auto", invalidPath: "Invalid path detected", loadSuccess: "", loadError: "", loadDefault: "", saveSuccess: "", saveFailed: "" },
        modules: { title: "Modules", desc: "", modeAuto: "Overlay", modeMagic: "Magic", scanning: "...", reload: "Refresh", save: "Save", empty: "Empty", scanError: "", saveSuccess: "", saveFailed: "", searchPlaceholder: "Search", filterLabel: "Filter", filterAll: "All" },
        logs: { title: "Logs", loading: "...", refresh: "Refresh", empty: "Empty", copy: "Copy", copySuccess: "Copied", copyFail: "Failed", searchPlaceholder: "Search", filterLabel: "Filter", levels: { all: "All", info: "Info", warn: "Warn", error: "Error" } },
        info: { title: "About", projectLink: "Repository", donate: "Donate", contributors: "Contributors", loading: "Loading...", loadFail: "Failed to load", noBio: "No bio available" }
    };
  },

  get modeStats() {
    let auto = 0;
    let magic = 0;
    let overlay = 0;
    this.modules.forEach(m => {
      if (m.mode === 'magic') magic++;
      else if (m.mode === 'overlay') overlay++;
      else auto++;
    });
    return { auto, magic, overlay };
  },

  // Actions
  showToast(msg, type = 'info') {
    this.toast = { text: msg, type, visible: true };
    setTimeout(() => { this.toast.visible = false; }, 3000);
  },

  // Internal helper to apply theme
  applyTheme() {
    const isDark = this.theme === 'auto' ? this.isSystemDark : this.theme === 'dark';
    const attr = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', attr);
    Monet.apply(this.seed, isDark, this.uiOpacity);
  },

  setTheme(newTheme) {
    this.theme = newTheme;
    localStorage.setItem('mm-theme', newTheme);
    this.applyTheme();
  },

  setUiOpacity(value) {
    this.uiOpacity = value;
    localStorage.setItem('mm-ui-opacity', value.toString());
    document.documentElement.style.setProperty('--ui-opacity', value);
    this.applyTheme();
  },

  setBackgroundImage(url) {
    try {
      if (!url) {
        localStorage.removeItem('mm-bg-image');
        this.backgroundImage = '';
      } else {
        localStorage.setItem('mm-bg-image', url);
        this.backgroundImage = url;
      }
    } catch (e) {
      console.error("Failed to save background image", e);
      this.showToast(this.L.config.imageTooLarge || "Image too large to save", "error");
    }
  },

  setShowAdvanced(show) {
    this.showAdvanced = show;
    localStorage.setItem('mm-show-advanced', show ? 'true' : 'false');
  },

  async setLang(code) {
    const path = `../locales/${code}.json`;
    if (localeModules[path]) {
      try {
        const mod = localeModules[path];
        this.loadedLocale = mod.default; 
        this.lang = code;
        localStorage.setItem('mm-lang', code);
      } catch (e) {
        console.error(`Failed to load locale: ${code}`, e);
        if (code !== 'en') await this.setLang('en');
      }
    }
  },

  async init() {
    const savedLang = localStorage.getItem('mm-lang') || 'en';
    await this.setLang(savedLang);
    
    // Theme Logic
    this.theme = localStorage.getItem('mm-theme') || 'auto';
    this.backgroundImage = localStorage.getItem('mm-bg-image') || '';
    this.uiOpacity = parseFloat(localStorage.getItem('mm-ui-opacity') || '1.0');
    document.documentElement.style.setProperty('--ui-opacity', this.uiOpacity);
    this.showAdvanced = localStorage.getItem('mm-show-advanced') === 'true';
    
    // System dark mode listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.isSystemDark = mediaQuery.matches;
    
    mediaQuery.addEventListener('change', (e) => {
      this.isSystemDark = e.matches;
      if (this.theme === 'auto') {
        this.applyTheme();
      }
    });
    
    // Fetch system color for monet
    const sysColor = await API.fetchSystemColor();
    if (sysColor) {
      this.seed = sysColor;
    }

    // Fetch version
    this.version = await API.getVersion();
    
    this.applyTheme();
    await this.loadConfig();
  },

  async loadConfig() {
    this.loading.config = true;
    try {
      this.config = await API.loadConfig();
      if (this.L && this.L.config) {
          this.showToast(this.L.config.loadSuccess);
      }
    } catch (e) {
      if (this.L && this.L.config) {
          this.showToast(this.L.config.loadError, 'error');
      }
    }
    this.loading.config = false;
  },

  async saveConfig() {
    this.saving.config = true;
    try {
      await API.saveConfig(this.config);
      this.showToast(this.L.config.saveSuccess);
    } catch (e) {
      this.showToast(this.L.config.saveFailed, 'error');
    }
    this.saving.config = false;
  },

  async loadModules() {
    this.loading.modules = true;
    this.modules = [];
    try {
      this.modules = await API.scanModules(this.config.moduledir);
    } catch (e) {
      this.showToast(this.L.modules.scanError, 'error');
    }
    this.loading.modules = false;
  },

  async saveModules() {
    this.saving.modules = true;
    try {
      await API.saveModules(this.modules);
      await API.saveRules(this.modules);
      this.showToast(this.L.modules.saveSuccess);
    } catch (e) {
      this.showToast(this.L.modules.saveFailed, 'error');
    }
    this.saving.modules = false;
  },

  async loadLogs(silent = false) {
    if (!silent) this.loading.logs = true;
    if (!silent) this.logs = []; 
    
    try {
      const source = this.logSource === 'kernel' ? 'kernel' : this.config.logfile;
      const raw = await API.readLogs(source, 1000);
      
      if (!raw) {
        this.logs = [{ text: this.L.logs.empty, type: 'debug' }];
      } else {
        this.logs = raw.split('\n').map(line => {
          let type = 'debug';
          if (line.includes('[ERROR]') || line.includes('error:')) type = 'error';
          else if (line.includes('[WARN]') || line.includes('warning:')) type = 'warn';
          else if (line.includes('[INFO]') || line.includes('hymofs:')) type = 'info';
          return { text: line, type };
        });
      }
    } catch (e) {
      console.error(e);
      this.logs = [{ text: `Error: ${e.message}`, type: 'error' }];
      if (!silent) this.showToast(this.L.logs.readFailed, 'error');
    }
    this.loading.logs = false;
  },

  setLogSource(source) {
    this.logSource = source;
    this.loadLogs();
  },

  async loadStatus() {
    this.loading.status = true;
    try {
      const [storageData, sysInfoData] = await Promise.all([
        API.getStorageUsage(),
        API.getSystemInfo()
      ]);
      
      this.storage = storageData;
      this.systemInfo = sysInfoData;
      // Use activeMounts from systemInfo (which comes from daemon_state.json)
      // instead of calling getActiveMounts() which only greps 'mount' command
      this.activePartitions = sysInfoData.activeMounts || [];
      this.activeHymoModules = sysInfoData.hymofsModules || [];

      if (this.modules.length === 0) {
        this.modules = await API.scanModules(this.config.moduledir);
      }
    } catch (e) {
      // ignore
    }
    this.loading.status = false;
  }
});