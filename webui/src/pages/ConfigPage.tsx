import { useState } from 'react'
import { useStore } from '@/store'
import { Card, Button, Input, Switch, Select } from '@/components/ui'
import { Save, Plus, X } from 'lucide-react'

export function ConfigPage() {
  const { t, config, showAdvanced, setShowAdvanced, updateConfig, saveConfig } = useStore()
  const [newPartition, setNewPartition] = useState('')

  const handleSave = async () => {
    await saveConfig()
  }

  const addPartition = () => {
    if (!newPartition.trim()) return
    const parts = newPartition.split(/[, ]+/).map(s => s.trim()).filter(Boolean)
    const updated = [...new Set([...config.partitions, ...parts])]
    updateConfig({ partitions: updated })
    setNewPartition('')
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
      {/* General Settings */}
      <Card>
        <h3 className="text-xl font-bold text-white mb-6">{t.config.general}</h3>
        
        <div className="space-y-4">
          <Input
            label={t.config.moduleDir}
            value={config.moduledir}
            onChange={(e) => updateConfig({ moduledir: e.target.value })}
            placeholder="/data/adb/modules"
          />

          <Input
            label={t.config.tempDir}
            value={config.tempdir}
            onChange={(e) => updateConfig({ tempdir: e.target.value })}
            placeholder="/data/adb/hymo/temp"
          />

          <Select
            label={t.config.mountSource}
            value={config.mountsource}
            onChange={(e) => updateConfig({ mountsource: e.target.value })}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'hymofs', label: 'HymoFS' },
              { value: 'overlay', label: 'OverlayFS' },
              { value: 'magic', label: 'Magic Mount' },
            ]}
          />
        </div>
      </Card>

      {/* Advanced Settings Toggle */}
      <Card>
        <Switch
          checked={showAdvanced}
          onChange={setShowAdvanced}
          label={t.config.showAdvanced}
        />
      </Card>

      {/* Advanced Settings */}
      {showAdvanced && (
        <Card>
          <h3 className="text-xl font-bold text-white mb-6">{t.config.advanced}</h3>
          
          <div className="space-y-4">
            <Switch
              checked={config.verbose}
              onChange={(checked) => updateConfig({ verbose: checked })}
              label={t.config.verbose}
            />

            <Switch
              checked={config.force_ext4}
              onChange={(checked) => updateConfig({ force_ext4: checked })}
              label={t.config.forceExt4}
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
              checked={config.avc_spoof}
              onChange={(checked) => updateConfig({ avc_spoof: checked })}
              label={t.config.avcSpoof}
            />
          </div>
        </Card>
      )}

      {/* Custom Partitions */}
      <Card>
        <h3 className="text-xl font-bold text-white mb-4">{t.config.partitions}</h3>
        
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
              className="flex items-center gap-2 px-3 py-1 bg-primary-600/20 border border-primary-500/30 rounded-lg"
            >
              <span className="text-white text-sm">{partition}</span>
              <button
                onClick={() => removePartition(index)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Save Button */}
      <Card>
        <Button onClick={handleSave} className="w-full" size="lg">
          <Save size={20} className="mr-2" />
          {t.common.save}
        </Button>
      </Card>
    </div>
  )
}
