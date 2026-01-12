import { useEffect } from 'react'
import { useStore } from '@/store'
import { Card, Badge } from '@/components/ui'
import { HardDrive, Package, Layers } from 'lucide-react'
import { BUILTIN_PARTITIONS } from '@/types'

export function StatusPage() {
  const { t, storage, modules, systemInfo, config, activePartitions, loadStatus } = useStore()

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [loadStatus])

  const displayPartitions = [...new Set([...BUILTIN_PARTITIONS, ...config.partitions])]
  const hymoFsCount = config.hymofs_available ? (systemInfo.hymofsModules?.length ?? 0) : t.status.notSupported

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-600/20 rounded-lg">
              <HardDrive className="text-primary-600 dark:text-primary-400" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t.status.storage}</h3>
              {storage.mode && (
                <Badge variant={storage.mode === 'tmpfs' ? 'success' : 'default'} className="mt-1">
                  {storage.mode.toUpperCase()}
                </Badge>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{storage.percent}%</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{storage.used} / {storage.size}</div>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-500 rounded-full"
            style={{ width: `${storage.percent}%` }}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="text-center">
          <div className="flex flex-col items-center gap-2">
            <Package className="text-primary-600 dark:text-primary-400" size={32} />
            <div className="text-4xl font-bold text-gray-900 dark:text-white">{modules.length}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{t.status.modules}</div>
          </div>
        </Card>

        <Card className="text-center">
          <div className="flex flex-col items-center gap-2">
            <Layers className="text-primary-600 dark:text-primary-400" size={32} />
            <div className="text-4xl font-bold text-gray-900 dark:text-white">{hymoFsCount}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">HymoFS</div>
          </div>
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t.status.partitions}</h3>
        <div className="flex flex-wrap gap-2">
          {displayPartitions.map((partition) => {
            const isActive = activePartitions.includes(partition)
            return (
              <Badge
                key={partition}
                variant={isActive ? 'success' : 'default'}
                className="px-3 py-1"
              >
                {partition}
              </Badge>
            )
          })}
        </div>
      </Card>

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t.status.systemInfo}</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/10">
            <span className="text-gray-500 dark:text-gray-400">{t.status.kernel}</span>
            <span className="text-gray-900 dark:text-white font-mono text-sm">{systemInfo.kernel}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/10">
            <span className="text-gray-500 dark:text-gray-400">{t.status.selinux}</span>
            <Badge variant={systemInfo.selinux === 'Permissive' ? 'success' : 'warning'}>
              {systemInfo.selinux}
            </Badge>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-500 dark:text-gray-400">{t.status.mountBase}</span>
            <span className="text-gray-900 dark:text-white font-mono text-sm">{systemInfo.mountBase}</span>
          </div>
        </div>
      </Card>

      {/* Warning for protocol mismatch */}
      {systemInfo.hymofsMismatch && (
        <Card className="border-red-500 bg-red-600/10">
          <div className="flex items-start gap-3">
            <div className="text-red-400 text-2xl">⚠️</div>
            <div>
              <h4 className="text-red-400 font-semibold mb-1">{t.status.hymofsMismatch}</h4>
              <p className="text-gray-300 text-sm">
                {systemInfo.mismatchMessage || 'Please update kernel/module to match versions'}
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
