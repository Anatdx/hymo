import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { api } from '@/services/api'
import { Card, Button } from '@/components/ui'
import { RefreshCw, Terminal } from 'lucide-react'

export function LogsPage() {
  const { t } = useStore()
  const [logType, setLogType] = useState<'system' | 'kernel'>('system')
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(false)

  const loadLogs = async () => {
    setLoading(true)
    try {
      const logPath = logType === 'kernel' ? 'kernel' : '/data/adb/hymo/hymo.log'
      const content = await api.readLogs(logPath, 1000)
      setLogs(content)
    } catch (error) {
      useStore.getState().showToast('Failed to load logs', 'error')
      setLogs('')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [logType])

  const handleRefresh = () => {
    loadLogs()
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={logType === 'system' ? 'primary' : 'ghost'}
              onClick={() => setLogType('system')}
            >
              {t.logs.systemLog}
            </Button>
            <Button
              variant={logType === 'kernel' ? 'primary' : 'ghost'}
              onClick={() => setLogType('kernel')}
            >
              {t.logs.kernelLog}
            </Button>
          </div>

          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </Card>

      {/* Log Display */}
      <Card className="min-h-[500px]">
        <div className="flex items-center gap-2 mb-4">
          <Terminal size={20} className="text-primary-400" />
          <h3 className="text-lg font-semibold text-white">
            {logType === 'system' ? t.logs.systemLog : t.logs.kernelLog}
          </h3>
        </div>

        <div className="bg-black/50 rounded-lg p-4 font-mono text-sm overflow-auto max-h-[600px]">
          {loading ? (
            <div className="text-gray-400 animate-pulse">{t.common.loading}</div>
          ) : logs ? (
            <pre className="text-green-400 whitespace-pre-wrap break-words">{logs}</pre>
          ) : (
            <div className="text-gray-500 italic">{t.logs.noLogs}</div>
          )}
        </div>
      </Card>
    </div>
  )
}
