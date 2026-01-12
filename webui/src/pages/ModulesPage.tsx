import { useEffect, useState, useRef } from 'react'
import { useStore } from '@/store'
import { api } from '@/services/api'
import { Card, Button, Input, Select, Badge } from '@/components/ui'
import { Search, Plus, Trash2, AlertCircle, ChevronDown, ChevronUp, Play, Pause, Loader2 } from 'lucide-react'

export function ModulesPage() {
  const { t, modules, loadModules, updateModule, saveModules, systemInfo, loadStatus } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all')
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [conflicts, setConflicts] = useState<any[]>([])
  const [checking, setChecking] = useState(false)
  const [togglingMount, setTogglingMount] = useState<Set<string>>(new Set())

  const modulesRef = useRef(modules)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (JSON.stringify(modules) === JSON.stringify(modulesRef.current)) return

    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(async () => {
      await saveModules(true)
      modulesRef.current = modules
    }, 1000)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [modules, saveModules])


  useEffect(() => {
    loadModules()
    loadStatus()
  }, [loadModules, loadStatus])

  const filteredModules = modules.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        m.id.toLowerCase().includes(searchQuery.toLowerCase())
    const matchFilter = filterMode === 'all' || m.mode === filterMode
    return matchSearch && matchFilter
  })

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedModules)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedModules(newExpanded)
  }

  const addRule = (moduleId: string) => {
    const module = modules.find(m => m.id === moduleId)
    if (!module) return
    
    const newRules = [...(module.rules || []), { path: '', mode: 'hymofs' }]
    updateModule(moduleId, { rules: newRules })
  }

  const removeRule = (moduleId: string, ruleIndex: number) => {
    const module = modules.find(m => m.id === moduleId)
    if (!module) return
    
    const newRules = [...module.rules]
    newRules.splice(ruleIndex, 1)
    updateModule(moduleId, { rules: newRules })
  }

  const updateRule = (moduleId: string, ruleIndex: number, field: 'path' | 'mode', value: string) => {
    const module = modules.find(m => m.id === moduleId)
    if (!module) return
    
    const newRules = [...module.rules]
    newRules[ruleIndex] = { ...newRules[ruleIndex], [field]: value }
    updateModule(moduleId, { rules: newRules })
  }

  const handleToggleMount = async (moduleId: string, isMounted: boolean) => {
    setTogglingMount(prev => new Set(prev).add(moduleId))
    try {
      if (isMounted) {
        await api.hotUnmount(moduleId)
        useStore.getState().showToast(t.modules.hotUnmountSuccess, 'success')
      } else {
        await api.hotMount(moduleId)
        useStore.getState().showToast(t.modules.hotMountSuccess, 'success')
      }
      // Delay status refresh slightly to allow system update
      setTimeout(() => loadStatus(), 500)
    } catch (e) {
      useStore.getState().showToast(isMounted ? t.modules.hotUnmountFailed : t.modules.hotMountFailed, 'error')
    } finally {
      setTogglingMount(prev => {
        const next = new Set(prev)
        next.delete(moduleId)
        return next
      })
    }
  }

  const checkConflicts = async () => {
    setChecking(true)
    try {
      const result = await api.checkConflicts()
      setConflicts(result)
      if (result.length === 0) {
        useStore.getState().showToast(t.modules.noConflicts, 'success')
      }
    } catch (error) {
      useStore.getState().showToast(t.modules.checkConflictsFailed, 'error')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <Input
              placeholder={t.modules.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            options={[
              { value: 'all', label: t.modules.filterAll },
              { value: 'auto', label: t.modules.filterAuto },
              { value: 'hymofs', label: t.modules.filterHymofs },
              { value: 'overlay', label: t.modules.filterOverlay },
              { value: 'magic', label: t.modules.filterMagic },
            ]}
            className="sm:w-40"
          />

          <Button onClick={checkConflicts} disabled={checking}>
            <AlertCircle size={20} className="mr-2" />
            {t.modules.checkConflicts}
          </Button>
        </div>
      </Card>

      {conflicts.length > 0 && (
        <Card className="border-yellow-500 bg-yellow-100 dark:bg-yellow-600/10">
          <h4 className="text-yellow-700 dark:text-yellow-400 font-semibold mb-2">Conflicts Detected</h4>
          <ul className="text-yellow-900 dark:text-gray-300 text-sm space-y-1">
            {conflicts.map((conflict, i) => (
              <li key={i}>• {conflict.message || JSON.stringify(conflict)}</li>
            ))}
          </ul>
        </Card>
      )}

      {filteredModules.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">{t.modules.noModules}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredModules.map((module) => {
            const isExpanded = expandedModules.has(module.id)
            const isMounted = systemInfo.hymofsModules?.includes(module.id) || false
            const isToggling = togglingMount.has(module.id)
            
            return (
              <Card key={module.id}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{module.name}</h4>
                      <Badge variant="default">{module.version}</Badge>
                      {isMounted && <Badge variant="success" className="ml-2">{t.modules.mountSuccess}</Badge>}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{module.description}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">{module.id}</p>
                  </div>
                  
                  <button
                    onClick={() => toggleExpand(module.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={20} className="text-gray-600 dark:text-white" /> : <ChevronDown size={20} className="text-gray-600 dark:text-white" />}
                  </button>
                </div>

                <div className="flex items-center gap-4 mt-4">
                  <Select
                    label={t.modules.mode}
                    value={module.mode}
                    onChange={(e) => updateModule(module.id, { mode: e.target.value as any })}
                    options={[
                      { value: 'auto', label: t.modules.modeAuto },
                      { value: 'hymofs', label: t.modules.modeHymofs },
                      { value: 'overlay', label: t.modules.modeOverlay },
                      { value: 'magic', label: t.modules.modeMagic },
                      { value: 'none', label: t.modules.modeNone },
                    ]}
                    className="flex-1"
                  />
                  {(module.mode === 'hymofs' || module.mode === 'auto') && (
                   (module.mode === 'hymofs' || isMounted) && (
                      <div className="space-y-1 ml-auto">
                        <label className="block text-sm font-medium text-transparent select-none">Action</label>
                        <Button 
                            variant={isMounted ? "danger" : "success"}
                            onClick={() => handleToggleMount(module.id, isMounted)}
                            disabled={isToggling}
                            className="w-full sm:w-auto h-[42px]"
                        >
                            {isToggling ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : isMounted ? (
                                <>
                                    <Pause size={18} className="mr-2" />
                                    {t.modules.hotUnmount}
                                </>
                            ) : (
                                <>
                                    <Play size={18} className="mr-2" />
                                    {t.modules.hotMount}
                                </>
                            )}
                        </Button>
                      </div>
                   )
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10 animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-gray-900 dark:text-white font-medium">{t.modules.rules}</h5>
                      <Button size="sm" onClick={() => addRule(module.id)}>
                        <Plus size={16} className="mr-1" />
                        {t.modules.addRule}
                      </Button>
                    </div>

                    {module.rules?.length > 0 ? (
                      <div className="space-y-2">
                        {module.rules.map((rule, i) => (
                          <div key={i} className="flex gap-2 items-end">
                            <Input
                              label={i === 0 ? t.modules.path : undefined}
                              placeholder="/system/bin/app"
                              value={rule.path}
                              onChange={(e) => updateRule(module.id, i, 'path', e.target.value)}
                              className="flex-1"
                            />
                            <Select
                              label={i === 0 ? t.modules.mode : undefined}
                              value={rule.mode}
                              onChange={(e) => updateRule(module.id, i, 'mode', e.target.value)}
                              options={[
                                { value: 'hymofs', label: t.modules.modeHymofs },
                                { value: 'overlay', label: t.modules.modeOverlay },
                                { value: 'magic', label: t.modules.modeMagic },
                              ]}
                              className="w-32"
                            />
                            <Button
                              variant="danger"
                              size="md"
                              onClick={() => removeRule(module.id, i)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm italic">No rules defined</p>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
