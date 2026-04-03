import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { Card, Button, Input, Switch, Badge } from '@/components/ui'
import { Plus, Trash2, Eye, Wrench, AlertCircle, CheckCircle, FolderOpen, FileText, Cpu, Loader2 } from 'lucide-react'
import { api } from '@/services/api'

interface LkmStatus {
  loaded: boolean
  autoload: boolean
  kmi_override?: string
}

interface HymoFSRule {
  type: string
  path: string
  target?: string
  source?: string
  isUserDefined: boolean
}

const COMMON_PATHS = [
  { path: '/dev/scene', label: 'Scene', icon: '🧪' },
  { path: '/dev/cpuset/scene-daemon', label: '也是Scene', icon: '🧪' },
  { path: '/sdcard/Download/advanced', label: '爱玩机工具箱', icon: '📦' },
  { path: '/sdcard/MT2', label: 'MT管理器', icon: '🔑' },
]

const PATH_SUGGESTIONS = [
  '/data/adb/',
  '/system/app/',
  '/system/framework/',
  '/data/local/tmp/',
  '/sdcard/Download/',
  '/data/data/',
  '/vendor/app/',
  '/product/app/',
]

export function HymoFSPage() {
  const showToast = useStore((s) => s.showToast)
  const t = useStore((s) => s.t)
  const config = useStore((s) => s.config)
  const updateConfig = useStore((s) => s.updateConfig)
  const saveConfig = useStore((s) => s.saveConfig)
  const systemInfo = useStore((s) => s.systemInfo)
  const [userRules, setUserRules] = useState<string[]>([])
  const [allRules, setAllRules] = useState<HymoFSRule[]>([])
  const [newPath, setNewPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const [lkmStatus, setLkmStatus] = useState<LkmStatus | null>(null)
  const [lkmLoading, setLkmLoading] = useState(false)
  const [kmiOverrideInput, setKmiOverrideInput] = useState('')
  const configRef = useRef(config)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pathScrollTouchRef = useRef<{ x: number; y: number; locked: 'h' | 'v' | null }>({ x: 0, y: 0, locked: null })

  useEffect(() => {
    loadRules()
  }, [])

  useEffect(() => {
    api.getLkmStatus().then(setLkmStatus).catch(() => setLkmStatus(null))
  }, [])

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(async () => {
      if (JSON.stringify(config) === JSON.stringify(configRef.current)) return
      try {
        await saveConfig(true)
        configRef.current = config
      } catch (e) {
        showToast(t.common.error ?? 'Error', 'error')
      }
    }, 1000)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [config, saveConfig, showToast, t.common.error])

  useEffect(() => {
    if (newPath && newPath.startsWith('/')) {
      const matches = PATH_SUGGESTIONS.filter(s => 
        s.toLowerCase().includes(newPath.toLowerCase()) && s !== newPath
      )
      setFilteredSuggestions(matches)
      setShowSuggestions(matches.length > 0)
    } else {
      setShowSuggestions(false)
    }
  }, [newPath])

  const loadRules = async () => {
    try {
      setLoading(true)
      const [user, all] = await Promise.all([
        api.getUserHideRules(),
        api.getAllRules()
      ])
      setUserRules(user)
      setAllRules(all)
    } catch (error) {
      showToast(t.hideRules.failedLoad, 'error')
    } finally {
      setLoading(false)
    }
  }

  const addRule = async (path?: string) => {
    const pathToAdd = path || newPath.trim()
    
    if (!pathToAdd) {
      showToast(t.hideRules.enterPath, 'error')
      return
    }

    if (!pathToAdd.startsWith('/')) {
      showToast(t.hideRules.absolutePath, 'error')
      return
    }

    try {
      await api.addUserHideRule(pathToAdd)
      showToast(`${t.hideRules.hidden}: ${pathToAdd}`, 'success')
      setNewPath('')
      setShowSuggestions(false)
      await loadRules()
    } catch (error) {
      showToast(t.hideRules.failedAdd, 'error')
    }
  }

  const removeRule = async (path: string) => {
    try {
      await api.removeUserHideRule(path)
      showToast(`${t.hideRules.removed}: ${path}`, 'success')
      await loadRules()
    } catch (error) {
      showToast(t.hideRules.failedRemove, 'error')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addRule()
    }
  }

  const userRuleCount = userRules.length
  const totalRuleCount = allRules.length
  const hymofsFeatureNames = systemInfo.features?.names ?? []
  const hasCmdlineSpoof = hymofsFeatureNames.includes('cmdline_spoof')

  const refreshLkmStatus = () => {
    api.getLkmStatus().then(setLkmStatus).catch(() => setLkmStatus(null))
  }

  const handleLkmLoad = async () => {
    try {
      setLkmLoading(true)
      await api.lkmLoad()
      showToast(t.hymofs?.lkm?.loadSuccess ?? 'LKM loaded', 'success')
      refreshLkmStatus()
    } catch (e) {
      showToast(t.hymofs?.lkm?.loadFailed ?? 'Failed to load LKM', 'error')
    } finally {
      setLkmLoading(false)
    }
  }

  const handleLkmUnload = async () => {
    try {
      setLkmLoading(true)
      await api.lkmUnload()
      showToast(t.hymofs?.lkm?.unloadSuccess ?? 'LKM unloaded', 'success')
      refreshLkmStatus()
    } catch (e) {
      showToast(t.hymofs?.lkm?.unloadFailed ?? 'Failed to unload LKM', 'error')
    } finally {
      setLkmLoading(false)
    }
  }

  const handleLkmAutoload = async (on: boolean) => {
    try {
      await api.lkmSetAutoload(on)
      showToast(t.hymofs?.lkm?.autoloadSuccess ?? 'Autoload updated', 'success')
      setLkmStatus(prev => prev ? { ...prev, autoload: on } : null)
    } catch (e) {
      showToast(t.hymofs?.lkm?.autoloadFailed ?? 'Failed to set autoload', 'error')
    }
  }

  const handleLkmSetKmi = async () => {
    const kmi = kmiOverrideInput.trim()
    if (!kmi) return
    try {
      await api.lkmSetKmi(kmi)
      showToast(t.hymofs?.lkm?.kmiSetSuccess ?? 'KMI override set', 'success')
      setKmiOverrideInput('')
      refreshLkmStatus()
    } catch (e) {
      showToast(t.hymofs?.lkm?.kmiSetFailed ?? 'Failed to set KMI override', 'error')
    }
  }

  const handleLkmClearKmi = async () => {
    try {
      await api.lkmClearKmi()
      showToast(t.hymofs?.lkm?.kmiClearSuccess ?? 'KMI override cleared', 'success')
      setKmiOverrideInput('')
      refreshLkmStatus()
    } catch (e) {
      showToast(t.hymofs?.lkm?.kmiClearFailed ?? 'Failed to clear KMI override', 'error')
    }
  }

  useEffect(() => {
    if (lkmStatus?.kmi_override && !kmiOverrideInput) {
      setKmiOverrideInput(lkmStatus.kmi_override)
    }
  }, [lkmStatus?.kmi_override])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gradient">{t.hymofs.title || 'HymoFS Management'}</h1>
            <p className="text-gray-400 mt-1">
              {t.hymofs.subtitle || 'Manage HymoFS features'}
            </p>
          </div>
        </div>

        {/* LKM Management */}
        <Card>
          <div className="flex items-start gap-3 mb-4">
            <div className="p-3 bg-amber-500/20 rounded-lg">
              <Cpu size={24} className="text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {t.hymofs?.lkm?.title ?? 'HymoFS Kernel Module (LKM)'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t.hymofs?.lkm?.desc ?? 'Load/unload the HymoFS kernel module. Autoload controls boot-time loading.'}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium flex-shrink-0 ${
                lkmStatus?.loaded
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}
            >
              {lkmStatus?.loaded
                ? (t.hymofs?.lkm?.loaded ?? 'Loaded')
                : (t.hymofs?.lkm?.notLoaded ?? 'Not Loaded')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Switch
              checked={lkmStatus?.autoload ?? true}
              onChange={handleLkmAutoload}
              label={t.hymofs?.lkm?.autoload ?? 'Autoload at boot'}
              disabled={lkmStatus === null}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleLkmLoad}
                disabled={lkmLoading || lkmStatus?.loaded}
                size="sm"
                variant="success"
              >
                {lkmLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>{lkmLoading ? (t.common.loading ?? 'Loading...') : (t.hymofs?.lkm?.load ?? 'Load')}</span>
              </Button>
              <Button
                onClick={handleLkmUnload}
                disabled={lkmLoading || !lkmStatus?.loaded}
                size="sm"
                variant="danger"
              >
                {t.hymofs?.lkm?.unload ?? 'Unload'}
              </Button>
            </div>
          </div>
          {/* KMI Override */}
          <div className="mt-4 pt-4 border-t border-gray-700/50">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {t.hymofs?.lkm?.kmiOverride ?? 'KMI Override'} (e.g. 6.6.30-android15)
            </p>
            <div className="flex gap-2 flex-wrap">
              <Input
                value={kmiOverrideInput}
                onChange={(e) => setKmiOverrideInput(e.target.value)}
                placeholder={lkmStatus?.kmi_override || "6.6.30-android15"}
                className="flex-1 min-w-[140px]"
              />
              <Button onClick={handleLkmSetKmi} size="sm" variant="secondary" disabled={!kmiOverrideInput.trim()}>
                {t.hymofs?.lkm?.setKmi ?? 'Set'}
              </Button>
              <Button onClick={handleLkmClearKmi} size="sm" variant="ghost" disabled={!lkmStatus?.kmi_override}>
                {t.hymofs?.lkm?.clearKmi ?? 'Clear'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Enable HymoFS Switch */}
        <Card>
          <Switch
            checked={config.hymofs_enabled}
            onChange={(checked) => updateConfig({ hymofs_enabled: checked })}
            label={t.config.enableHymoFS || "Enable HymoFS"}
          />
        </Card>

        {/* Enable Hide/Xattr (mount_hide, maps_spoof, statfs_spoof) */}
        <Card>
          <Switch
            checked={config.enable_hidexattr ?? false}
            onChange={(checked) => updateConfig({ enable_hidexattr: checked })}
            label={t.config.enableHideXattr || "Mount hide / Maps spoof / Statfs spoof"}
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {t.config.enableHideXattrDesc || "Hide overlay from /proc/mounts, spoof /proc/pid/maps, spoof statfs f_type"}
          </p>
        </Card>

        {/* Kernel Version Spoofing Card */}
        <Card>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.config.unameSpoof}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t.config.unameSpoofDesc}</p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={() => updateConfig({ 
                  uname_release: systemInfo.unameRelease || '', 
                  uname_version: systemInfo.unameVersion || '' 
                })}
                size="sm"
                variant="secondary"
              >
                {t.config.useSystemValue || 'Use System Value'}
              </Button>
              <Button 
                onClick={() => updateConfig({ uname_release: '', uname_version: '' })}
                size="sm"
                variant="secondary"
              >
                {t.common.clear || 'Clear'}
              </Button>
            </div>
          </div>
          
          <div className="space-y-4">
            <Input
              label={t.config.unameRelease}
              value={config.uname_release}
              onChange={(e) => updateConfig({ uname_release: e.target.value })}
              placeholder={systemInfo.unameRelease || "5.15.0-generic"}
            />

            <Input
              label={t.config.unameVersion}
              value={config.uname_version}
              onChange={(e) => updateConfig({ uname_version: e.target.value })}
              placeholder={systemInfo.unameVersion || "#1 SMP PREEMPT ..."}
            />
          </div>
        </Card>

        <Card>
          <div className="flex justify-between items-center mb-4 gap-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Kernel Cmdline Spoofing</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {hasCmdlineSpoof
                  ? 'Persist and apply a fake /proc/cmdline value through HymoFS.'
                  : 'Current kernel does not report cmdline spoof support in its feature bitmask.'}
              </p>
            </div>
            <Button
              onClick={() => updateConfig({ cmdline_value: '' })}
              size="sm"
              variant="secondary"
            >
              {t.common.clear || 'Clear'}
            </Button>
          </div>
          <textarea
            value={config.cmdline_value}
            onChange={(e) => updateConfig({ cmdline_value: e.target.value })}
            placeholder="androidboot.verifiedbootstate=green buildvariant=user ..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-white/5 border border-gray-200 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 font-mono text-sm"
          />
        </Card>

        {(hymofsFeatureNames.length > 0 || systemInfo.hooks) && (
          <Card>
            <div className="space-y-4">
              {hymofsFeatureNames.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">Feature Flags</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Bitmask: <code className="font-mono">{`0x${(systemInfo.features?.bitmask ?? 0).toString(16)}`}</code>
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {hymofsFeatureNames.map((name) => (
                      <Badge key={name} variant="success" className="font-mono">
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {systemInfo.hooks && (
                <div className={hymofsFeatureNames.length > 0 ? 'pt-4 border-t border-gray-200 dark:border-white/10' : ''}>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {t.hymofs?.hooks?.title ?? 'Kernel Hooks'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t.hymofs?.hooks?.desc ?? 'HymoFS LKM hook status'}
                  </p>
                  <pre className="mt-3 p-3 rounded-lg bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words overflow-x-auto">
                    {systemInfo.hooks}
                  </pre>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Statistics */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 divide-y md:divide-y-0 md:divide-x divide-gray-200 dark:divide-gray-700">
            <div className="flex items-center gap-3 p-2">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Eye size={24} className="text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{userRuleCount}</div>
                <div className="text-sm text-gray-400">{t.hideRules.userRules}</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-2">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle size={24} className="text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{totalRuleCount}</div>
                <div className="text-sm text-gray-400">{t.hideRules.totalActive}</div>
              </div>
            </div>
          </div>
        </Card>

      </div>

      {/* Add New Rule */}
      <Card>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Plus size={20} />
          {t.hideRules.addTitle}
        </h2>
        
        <div className="space-y-4">
          <div className="relative">
            <Input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t.hideRules.placeholder}
              className="pr-24"
            />
            <Button
              onClick={() => addRule()}
              className="absolute right-1 top-1 h-8"
              size="sm"
            >
              <Plus size={16} className="mr-1" />
              {t.hideRules.add}
            </Button>

            {/* Suggestions Dropdown */}
            {showSuggestions && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {filteredSuggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setNewPath(suggestion)
                      setShowSuggestions(false)
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-700 transition-colors flex items-center gap-2 text-sm"
                  >
                    <FolderOpen size={14} className="text-gray-400" />
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Add Common Paths */}
          <div>
            <p className="text-sm text-gray-400 mb-2">{t.hideRules.quickAdd}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {COMMON_PATHS.map((item) => (
                <button
                  key={item.path}
                  onClick={() => addRule(item.path)}
                  disabled={userRules.includes(item.path)}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:cursor-not-allowed rounded-lg transition-colors text-left text-sm group"
                >
                  <span className="text-lg">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-200 group-hover:text-white truncate">
                      {item.label}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{item.path}</div>
                  </div>
                  {userRules.includes(item.path) && (
                    <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* User Rules List */}
      <Card>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Eye size={20} />
          {t.hideRules.yourRules} ({userRuleCount})
        </h2>

        {loading ? (
          <div className="text-center py-8 text-gray-400">{t.hideRules.loading}</div>
        ) : userRules.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Wrench size={48} className="mx-auto mb-2 opacity-50" />
            <p>{t.hideRules.noUserRules}</p>
            <p className="text-sm mt-1">{t.hideRules.noUserRulesHint}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {userRules.map((path) => (
              <div
                key={path}
                className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors group"
              >
                <FileText size={16} className="text-blue-400 flex-shrink-0" />
                <code className="flex-1 text-sm font-mono text-gray-300 truncate">
                  {path}
                </code>
                <Button
                  onClick={() => removeRule(path)}
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* All Active Rules — INJECT hidden; MERGE shows source; first two are usually uname SPOOF */}
      <Card>
        <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
          <Wrench size={20} />
          {t.hideRules.allRules} ({totalRuleCount})
        </h2>
        {t.hideRules.allRulesHint && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.hideRules.allRulesHint}</p>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-400">{t.hideRules.loading}</div>
        ) : allRules.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{t.hideRules.noActiveRules}</div>
        ) : (
          <ul className="divide-y divide-gray-700/50 max-h-96 overflow-y-auto rounded-lg border border-gray-700/50">
            {allRules.map((rule, index) => (
              <li
                key={`${rule.type}-${rule.path}-${rule.source ?? ''}-${index}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-800/40 transition-colors"
              >
                <span className="text-xs text-gray-500 font-medium tabular-nums w-10 flex-shrink-0">
                  {rule.type}
                </span>
                <div
                  className="flex-1 min-w-0 overflow-x-auto whitespace-nowrap no-scrollbar"
                  onTouchStart={(e) => {
                    pathScrollTouchRef.current = {
                      x: e.touches[0].clientX,
                      y: e.touches[0].clientY,
                      locked: null,
                    }
                  }}
                  onTouchMove={(e) => {
                    const { x, y, locked } = pathScrollTouchRef.current
                    const dx = e.touches[0].clientX - x
                    const dy = e.touches[0].clientY - y
                    const absDx = Math.abs(dx)
                    const absDy = Math.abs(dy)
                    if (locked === null && (absDx > 8 || absDy > 8)) {
                      pathScrollTouchRef.current.locked = absDx > absDy ? 'h' : 'v'
                    }
                    if (pathScrollTouchRef.current.locked === 'h') {
                      e.stopPropagation()
                    }
                  }}
                  onTouchEnd={() => {
                    pathScrollTouchRef.current.locked = null
                  }}
                >
                  <code className="text-sm font-mono text-gray-300">
                    {rule.path}
                    {rule.source != null && rule.source !== '' && (
                      <span className="text-gray-500"> ← {rule.source}</span>
                    )}
                    {rule.target != null && rule.target !== '' && !rule.source && (
                      <span className="text-gray-500"> → {rule.target}</span>
                    )}
                  </code>
                </div>
                {rule.isUserDefined && (
                  <span className="text-[10px] uppercase tracking-wide text-gray-500 flex-shrink-0">
                    {t.hideRules.user}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {/* Info Alert */}
      <Card className="bg-blue-500/10 border-blue-500/30">
        <div className="flex gap-3">
          <AlertCircle className="text-blue-400 flex-shrink-0 mt-1" size={20} />
          <div className="text-sm text-gray-300">
            <p className="font-semibold text-blue-400 mb-1">{t.hideRules.aboutTitle}</p>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>{t.hideRules.aboutHidden}</li>
              <li>{t.hideRules.aboutStorage}</li>
              <li>{t.hideRules.aboutModule}</li>
              <li>{t.hideRules.aboutRemove}</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
