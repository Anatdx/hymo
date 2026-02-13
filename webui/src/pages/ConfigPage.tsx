import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { api } from '@/services/api'
import { Card, Button, Input, Switch, RadioCards } from '@/components/ui'
import { Plus, X, Radar } from 'lucide-react'

export function ConfigPage() {
  const { t, config, showAdvanced, setShowAdvanced, updateConfig, saveConfig, useSystemFont, setUseSystemFont } = useStore((state) => state)
  const [newPartition, setNewPartition] = useState('')
  const [scanning, setScanning] = useState(false)
  
  const configRef = useRef(config)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (JSON.stringify(config) === JSON.stringify(configRef.current)) return
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    timeoutRef.current = setTimeout(async () => {
      try {
        await saveConfig(true)
        configRef.current = config
      } catch (e) {
        useStore.getState().showToast(t.common.error, 'error')
      }
    }, 1000)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [config, saveConfig, t])

  const addPartition = () => {
    if (!newPartition.trim()) return
    const parts = newPartition.split(/[, ]+/).map(s => s.trim()).filter(Boolean)
    const updated = [...new Set([...config.partitions, ...parts])]
    updateConfig({ partitions: updated })
    setNewPartition('')
  }
  
  const handleScanPartitions = async () => {
      setScanning(true)
      try {
          const partitions = await api.scanPartitionsFromModules(config.moduledir)
          if (partitions.length > 0) {
              const updated = [...new Set([...config.partitions, ...partitions])]
              updateConfig({ partitions: updated })
              useStore.getState().showToast(`${t.config.found} ${partitions.length} ${t.config.partitions}`, 'success')
          } else {
              useStore.getState().showToast(t.config.noNewPartitions, 'info')
          }
      } catch (e) {
          useStore.getState().showToast(t.config.scanPartitionsFailed, 'error')
      } finally {
          setScanning(false)
      }
  }

  const removePartition = (index: number) => {
    const updated = [...config.partitions]
    updated.splice(index, 1)
    updateConfig({ partitions: updated })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addPartition()
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{t.config.general}</h3>
        
        <div className="space-y-4">
          <Switch
            label={t.config.useSystemFont}
            checked={useSystemFont}
            onChange={setUseSystemFont}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.config.tempDir}
            </label>
            <RadioCards
              options={[
                { 
                  value: "/data/adb/hymo/img_mnt", 
                  label: "/data/adb/hymo/img_mnt", 
                  description: t.config.tempDirDefault 
                },
                { 
                  value: "/debug_ramdisk", 
                  label: "/debug_ramdisk", 
                  description: t.config.tempDirDebug 
                },
                { 
                  value: "/dev/hymo_mirror", 
                  label: "/dev/hymo_mirror", 
                  description: t.config.tempDirDevice 
                },
                { 
                  value: "custom", 
                  label: t.config.tempDirCustom, 
                  description: t.config.tempDirCustomDesc 
                },
              ]}
              value={["/data/adb/hymo/img_mnt", "/debug_ramdisk", "/dev/hymo_mirror"].includes(config.tempdir) ? config.tempdir : "custom"}
              onChange={(val) => {
                if (val !== "custom") {
                  updateConfig({ tempdir: val })
                }
              }}
            />
            {(!["/data/adb/hymo/img_mnt", "/debug_ramdisk", "/dev/hymo_mirror"].includes(config.tempdir)) && (
              <Input
                value={config.tempdir}
                onChange={(e) => updateConfig({ tempdir: e.target.value })}
                placeholder="/data/adb/hymo/custom_path"
                className="mt-2"
              />
            )}
          </div>

          <RadioCards
            label={t.config.fsType || "Filesystem Type"}
            options={[
                { value: "auto", label: t.config.fsAuto, description: t.config.fsAutoDesc },
                { value: "tmpfs", label: t.config.fsTmpfs, description: t.config.fsTmpfsDesc, disabled: !config.tmpfs_xattr_supported },
                { value: "erofs", label: t.config.fsErofs, description: t.config.fsErofsDesc },
                { value: "ext4", label: t.config.fsExt4, description: t.config.fsExt4Desc },
            ]}
            value={config.fs_type}
            onChange={(val) => updateConfig({ fs_type: val })}
          />

        </div>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t.config.partitions}</h3>
            <Button onClick={handleScanPartitions} disabled={scanning} size="sm" variant="secondary">
                <Radar size={16} className={scanning ? 'animate-spin mr-2' : 'mr-2'} />
                {scanning ? t.config.scanning : t.config.scanPartitions}
            </Button>
        </div>
        
        <div className="flex gap-2 mb-4">
          <Input
            placeholder={t.config.addPartition}
            value={newPartition}
            onChange={(e) => setNewPartition(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={addPartition} size="md">
            <Plus size={20} />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {config.partitions.map((partition, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-3 py-1 bg-primary-100 dark:bg-primary-600/20 border border-primary-200 dark:border-primary-500/30 rounded-lg"
            >
              <span className="text-gray-800 dark:text-white text-sm">{partition}</span>
              <button
                onClick={() => removePartition(index)}
                className="text-gray-500 hover:text-gray-800 dark:text-white/60 dark:hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Switch
          checked={showAdvanced}
          onChange={setShowAdvanced}
          label={t.config.showAdvanced}
        />
      </Card>

      {showAdvanced && (
        <Card>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{t.config.advanced}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{t.config.mountRunsInMetamount}</p>
          <div className="space-y-4">
            <Switch
              checked={config.debug}
              onChange={(checked) => updateConfig({ debug: checked })}
              label={t.config.debug}
            />
            
            {config.debug && (
              <div className="ml-6">
                <Switch
                  checked={config.verbose}
                  onChange={(checked) => updateConfig({ verbose: checked })}
                  label={t.config.verbose}
                />
              </div>
            )}
            
            <Switch
              checked={config.disable_umount}
              onChange={(checked) => updateConfig({ disable_umount: checked })}
              label={t.config.disableUmount}
            />

            <Switch
              checked={config.enable_nuke}
              onChange={(checked) => updateConfig({ enable_nuke: checked })}
              label={t.config.enableNuke}
            />

            <Switch
              checked={config.enable_stealth}
              onChange={(checked) => updateConfig({ enable_stealth: checked })}
              label={t.config.enableStealth}
            />

            <Switch
              checked={config.enable_kernel_debug}
              onChange={(checked) => updateConfig({ enable_kernel_debug: checked })}
              label={t.config.enableKernelDebug}
            />

            <Switch
              checked={config.ignore_protocol_mismatch}
              onChange={(checked) => updateConfig({ ignore_protocol_mismatch: checked })}
              label={t.config.ignoreProtocolMismatch}
            />

            <Input
              label={t.config.moduleDir}
              value={config.moduledir}
              onChange={(e) => updateConfig({ moduledir: e.target.value })}
              placeholder="/data/adb/modules"
            />
          
            <Input
              label={t.config.mountSource}
              value={config.mountsource}
              onChange={(e) => updateConfig({ mountsource: e.target.value })}
              placeholder="KSU"
            />
          </div>
        </Card>
      )}
    </div>
  )
}
