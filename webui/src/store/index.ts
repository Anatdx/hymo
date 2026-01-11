import { create } from 'zustand'
import { api } from '@/services/api'
import { translations, getNavigatorLanguage, type Language, type TranslationKey } from '@/i18n'
import { DEFAULT_CONFIG, BUILTIN_PARTITIONS, type Config, type Module, type StorageInfo, type SystemInfo } from '@/types'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface AppState {
  // UI State
  activeTab: 'status' | 'config' | 'modules' | 'logs' | 'info'
  setActiveTab: (tab: AppState['activeTab']) => void
  
  language: Language
  setLanguage: (lang: Language) => void
  t: TranslationKey
  
  showAdvanced: boolean
  setShowAdvanced: (show: boolean) => void
  
  backgroundImage: string | null
  setBackgroundImage: (url: string | null) => void
  
  // Toast notifications
  toasts: Toast[]
  showToast: (message: string, type?: ToastType) => void
  removeToast: (id: string) => void
  
  // Data State
  config: Config
  modules: Module[]
  storage: StorageInfo
  systemInfo: SystemInfo
  activePartitions: string[]
  activeHymoModules: string[]
  
  loading: boolean
  
  // Actions
  loadConfig: () => Promise<void>
  saveConfig: () => Promise<void>
  updateConfig: (updates: Partial<Config>) => void
  
  loadModules: () => Promise<void>
  saveModules: () => Promise<void>
  updateModule: (id: string, updates: Partial<Module>) => void
  
  loadStatus: () => Promise<void>
  
  initialize: () => Promise<void>
}

export const useStore = create<AppState>((set, get) => ({
  // UI State
  activeTab: 'status',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  language: getNavigatorLanguage(),
  setLanguage: (lang) => {
    set({ language: lang, t: translations[lang] })
    localStorage.setItem('hymo_language', lang)
  },
  t: translations[getNavigatorLanguage()],
  
  showAdvanced: false,
  setShowAdvanced: (show) => {
    set({ showAdvanced: show })
    localStorage.setItem('hymo_show_advanced', String(show))
  },
  
  backgroundImage: localStorage.getItem('hymo_background') || null,
  setBackgroundImage: (url) => {
    set({ backgroundImage: url })
    if (url) {
      localStorage.setItem('hymo_background', url)
    } else {
      localStorage.removeItem('hymo_background')
    }
  },
  
  // Toast
  toasts: [],
  showToast: (message, type = 'info') => {
    const id = Math.random().toString(36).substr(2, 9)
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }))
    setTimeout(() => {
      get().removeToast(id)
    }, 3000)
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
  },
  
  // Data State
  config: DEFAULT_CONFIG,
  modules: [],
  storage: {
    size: '-',
    used: '-',
    avail: '-',
    percent: '0%',
    type: null,
  },
  systemInfo: {
    kernel: 'Loading...',
    selinux: 'Loading...',
    mountBase: '/dev/hymofs',
  },
  activePartitions: [],
  activeHymoModules: [],
  
  loading: false,
  
  // Actions
  loadConfig: async () => {
    try {
      set({ loading: true })
      const config = await api.loadConfig()
      set({ config })
    } catch (error) {
      get().showToast('Failed to load config', 'error')
      console.error(error)
    } finally {
      set({ loading: false })
    }
  },
  
  saveConfig: async () => {
    try {
      set({ loading: true })
      await api.saveConfig(get().config)
      get().showToast(get().t.config.saved, 'success')
    } catch (error) {
      get().showToast(get().t.config.saveFailed, 'error')
      console.error(error)
    } finally {
      set({ loading: false })
    }
  },
  
  updateConfig: (updates) => {
    set((state) => ({
      config: { ...state.config, ...updates }
    }))
  },
  
  loadModules: async () => {
    try {
      set({ loading: true })
      const modules = await api.scanModules()
      set({ modules })
    } catch (error) {
      get().showToast('Failed to load modules', 'error')
      console.error(error)
    } finally {
      set({ loading: false })
    }
  },
  
  saveModules: async () => {
    try {
      set({ loading: true })
      await api.saveModules(get().modules)
      await api.saveRules(get().modules)
      get().showToast('Modules saved', 'success')
    } catch (error) {
      get().showToast('Failed to save modules', 'error')
      console.error(error)
    } finally {
      set({ loading: false })
    }
  },
  
  updateModule: (id, updates) => {
    set((state) => ({
      modules: state.modules.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      )
    }))
  },
  
  loadStatus: async () => {
    try {
      const [storage, systemInfo] = await Promise.all([
        api.getStorageUsage(),
        api.getSystemInfo(),
      ])
      
      // Derive active partitions
      const allPartitions = [...BUILTIN_PARTITIONS, ...get().config.partitions]
      const activePartitions = allPartitions.filter(() => true) // TODO: Add actual filtering logic
      
      set({
        storage,
        systemInfo,
        activePartitions,
        activeHymoModules: systemInfo.hymofsModules || [],
      })
    } catch (error) {
      console.error('Failed to load status:', error)
    }
  },
  
  initialize: async () => {
    // Restore saved preferences
    const savedLang = localStorage.getItem('hymo_language') as Language
    if (savedLang && translations[savedLang]) {
      get().setLanguage(savedLang)
    }
    
    const savedAdvanced = localStorage.getItem('hymo_show_advanced')
    if (savedAdvanced) {
      set({ showAdvanced: savedAdvanced === 'true' })
    }
    
    // Load initial data
    await Promise.all([
      get().loadConfig(),
      get().loadModules(),
      get().loadStatus(),
    ])
  },
}))
