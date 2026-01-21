import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { Card, Button, Input } from '@/components/ui'
import { Plus, Trash2, Eye, EyeOff, AlertCircle, CheckCircle, FolderOpen, FileText } from 'lucide-react'
import { api } from '@/services/api'

interface HideRule {
  path: string
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

export function HideRulesPage() {
  const { showToast, t } = useStore()
  const [userRules, setUserRules] = useState<string[]>([])
  const [allRules, setAllRules] = useState<HideRule[]>([])
  const [newPath, setNewPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])

  useEffect(() => {
    loadRules()
  }, [])

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
        api.getAllHideRules()
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
  const moduleRuleCount = allRules.filter(r => !r.isUserDefined).length
  const totalRuleCount = allRules.length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gradient">{t.hideRules.title}</h1>
            <p className="text-gray-400 mt-1">
              {t.hideRules.subtitle}
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-500/10 border-blue-500/30">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/20 rounded-lg">
                <Eye size={24} className="text-blue-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-400">{userRuleCount}</div>
                <div className="text-sm text-gray-400">{t.hideRules.userRules}</div>
              </div>
            </div>
          </Card>

          <Card className="bg-purple-500/10 border-purple-500/30">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-lg">
                <EyeOff size={24} className="text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">{moduleRuleCount}</div>
                <div className="text-sm text-gray-400">{t.hideRules.moduleRules}</div>
              </div>
            </div>
          </Card>

          <Card className="bg-green-500/10 border-green-500/30">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/20 rounded-lg">
                <CheckCircle size={24} className="text-green-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-400">{totalRuleCount}</div>
                <div className="text-sm text-gray-400">{t.hideRules.totalActive}</div>
              </div>
            </div>
          </Card>
        </div>

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
            <EyeOff size={48} className="mx-auto mb-2 opacity-50" />
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

      {/* All Active Rules */}
      <Card>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <EyeOff size={20} />
          {t.hideRules.allRules} ({totalRuleCount})
        </h2>

        {loading ? (
          <div className="text-center py-8 text-gray-400">{t.hideRules.loading}</div>
        ) : allRules.length === 0 ? (
          <div className="text-center py-8 text-gray-400">{t.hideRules.noActiveRules}</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {allRules.map((rule, index) => (
              <div
                key={`${rule.path}-${index}`}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  rule.isUserDefined
                    ? 'bg-blue-500/10 border border-blue-500/30'
                    : 'bg-gray-800/30 border border-gray-700/30'
                }`}
              >
                <FileText
                  size={16}
                  className={rule.isUserDefined ? 'text-blue-400' : 'text-gray-500'}
                />
                <code className="flex-1 text-sm font-mono text-gray-300 truncate">
                  {rule.path}
                </code>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    rule.isUserDefined
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {rule.isUserDefined ? t.hideRules.user : t.hideRules.module}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
