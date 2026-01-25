import { useEffect } from 'react'
import { useStore } from '@/store'
import { Card, Badge } from '@/components/ui'
import { HardDrive, Package, Layers } from 'lucide-react'
import { BUILTIN_PARTITIONS } from '@/types'

export function StatusPage() {
  const { t, storage, modules, systemInfo, config, activePartitions, loadStatus } = useStore((state) => state)

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [loadStatus])

  const displayPartitions = [...new Set([...BUILTIN_PARTITIONS, ...config.partitions])]
  // 显示实际以HymoFS挂载的模块数量，而不是配置中选择的数量
  const hymoFsCount = (systemInfo.hymofsModules?.length ?? 0)

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
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{Math.round(storage.percent)}%</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{storage.used} / {storage.size}</div>
          </div>
        </div>
        
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-full transition-all duration-500 rounded-full"
            style={{ width: `${Math.round(storage.percent)}%` }}
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
            const partitionInfo = systemInfo.detectedPartitions?.find(p => p.name === partition)
            const tooltipText = partitionInfo ? `${partitionInfo.mount_point} (${partitionInfo.fs_type}${partitionInfo.is_read_only ? ', ro' : ''})` : undefined
            return (
              <div key={partition} title={tooltipText}>
                <Badge
                  variant={isActive ? 'success' : 'default'}
                  className="px-3 py-1"
                >
                  {partition}
                </Badge>
              </div>
            )
          })}
        </div>
      </Card>

      {systemInfo.mountStats && (
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">{t.status.mountStats || 'Mount Statistics'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t.status.totalMounts || 'Total Mounts'}</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{systemInfo.mountStats.total_mounts}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t.status.successfulMounts || 'Successful'}</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">{systemInfo.mountStats.successful_mounts}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t.status.failedMounts || 'Failed'}</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">{systemInfo.mountStats.failed_mounts}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t.status.successRate || 'Success Rate'}</div>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {systemInfo.mountStats.success_rate ? `${systemInfo.mountStats.success_rate.toFixed(1)}%` : 'N/A'}
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/10">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{t.status.filesMounted || 'Files'}</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{systemInfo.mountStats.files_mounted}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{t.status.dirsMounted || 'Directories'}</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{systemInfo.mountStats.dirs_mounted}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{t.status.symlinksCreated || 'Symlinks'}</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{systemInfo.mountStats.symlinks_created}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-300">{t.status.overlayMounts || 'Overlay'}</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">{systemInfo.mountStats.overlayfs_mounts}</div>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">{t.status.systemInfo}</h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/10">
            <span className="text-gray-500 dark:text-gray-400 flex-shrink-0">{t.status.kernel}</span>
            <span 
              className="text-gray-900 dark:text-white font-mono text-sm overflow-x-auto whitespace-nowrap ml-4 no-scrollbar"
              onTouchStart={(e) => e.stopPropagation()}
            >{systemInfo.kernel}</span>
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
