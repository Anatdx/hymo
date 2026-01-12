import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { api } from '@/services/api'
import { Card, Button, Select } from '@/components/ui'
import { RefreshCw, Terminal, Copy, Search } from 'lucide-react'

export function LogsPage() {
  const { t } = useStore()
  const [logType, setLogType] = useState<'system' | 'kernel'>('system')
  const [logs, setLogs] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [logLevel, setLogLevel] = useState('all')

  const loadLogs = async () => {
    setLoading(true)
    try {
      const logPath = logType === 'kernel' ? 'kernel' : '/data/adb/hymo/daemon.log'
      const content = await api.readLogs(logPath, 1000)
      setLogs(content)
    } catch (error) {
      useStore.getState().showToast(t.logs.loadFailed, 'error')
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

  const handleCopy = () => {
    if (!logs) return
    navigator.clipboard.writeText(logs)
    useStore.getState().showToast(t.logs.copied, 'success')
  }

  const renderLogLine = (line: string, index: number) => {
    if (!line.trim()) return null
    if (logType === 'kernel') {
        return <div key={index} className="text-gray-700 dark:text-gray-300">{line}</div>
    }

    let className = "text-gray-700 dark:text-gray-300"
    
    if (line.includes('[ERROR]')) {
        className = "text-red-600 dark:text-red-400"
    } else if (line.includes('[WARN]')) {
        className = "text-orange-600 dark:text-orange-400"
    } else if (line.includes('[INFO]')) {
        className = "text-blue-600 dark:text-blue-400"
    } else if (line.includes('[DEBUG]')) {
        className = "text-green-600 dark:text-green-400"
    }

    return <div key={index} className={`${className} font-mono whitespace-pre-wrap break-words`}>{line}</div>
  }

  const getFilteredLogs = () => {
    if (!logs) return []
    return logs.split('\n').filter(line => {
      const lowerLine = line.toLowerCase()
      const matchSearch = !searchText || lowerLine.includes(searchText.toLowerCase())
      let matchLevel = true
    
      if (logType === 'kernel') return matchSearch

      if (logLevel === 'error') {
        matchLevel = line.includes('[ERROR]')
      } else if (logLevel === 'warning') {
        matchLevel = line.includes('[WARN]')
      } else if (logLevel === 'info') {
        matchLevel = line.includes('[INFO]')
      } else if (logLevel === 'debug') {
        matchLevel = line.includes('[DEBUG]')
      }
      
      return matchSearch && matchLevel
    })
  }

  const filteredLogsList = getFilteredLogs()

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      <Card className="flex-none">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-y-2">
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                <Button
                  variant={logType === 'system' ? 'primary' : 'ghost'}
                  onClick={() => setLogType('system')}
                  size="sm"
                  className="!px-3 !py-1 h-8"
                >
                  {t.logs.systemLog}
                </Button>
                <Button
                  variant={logType === 'kernel' ? 'primary' : 'ghost'}
                  onClick={() => setLogType('kernel')}
                  size="sm"
                  className="!px-3 !py-1 h-8"
                >
                  {t.logs.kernelLog}
                </Button>
              </div>

              {logType !== 'kernel' && (
                <Select
                  options={[
                    { value: 'all', label: t.logs.all },
                    { value: 'debug', label: t.logs.debug },
                    { value: 'info', label: t.logs.info },
                    { value: 'warning', label: t.logs.warning },
                    { value: 'error', label: t.logs.error },
                  ]}
                  value={logLevel}
                  onChange={(e) => setLogLevel(e.target.value)}
                  className="w-24 !py-1 !text-xs !h-8"
                />
              )}
            </div>

            <div className="flex gap-2">
              <Button onClick={handleCopy} size="sm" variant="secondary" title="Copy Logs" className="h-8 w-8 !p-0">
                <Copy size={14} />
              </Button>

              <Button onClick={handleRefresh} disabled={loading} size="sm" className="h-8 w-8 !p-0">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </Button>
            </div>
          </div>

          <div className="relative w-full">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
            <input
              className="w-full pl-8 pr-2 py-1.5 text-sm rounded-md bg-gray-100 dark:bg-white/10 border-transparent focus:bg-white dark:focus:bg-black focus:ring-1 ring-primary-500 text-gray-900 dark:text-white outline-none transition-all"
              placeholder="Search logs..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
      </Card>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden !p-0 bg-white dark:bg-[#1e1e1e] border-gray-200 dark:border-white/10">
        <div className="flex items-center gap-2 p-3 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/5">
          <Terminal size={16} className="text-primary-600 dark:text-primary-400" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {logType === 'system' ? t.logs.systemLog : t.logs.kernelLog}
          </h3>
          <div className="flex-1 text-right text-xs text-gray-400">
             {filteredLogsList.length} lines
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-[#0a0a0a] font-mono text-xs sm:text-sm">
          {loading ? (
            <div className="text-gray-400 animate-pulse flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                {t.common.loading}
            </div>
          ) : logs ? (
            <div className="flex flex-col">
                {filteredLogsList.length > 0 ? (
                    filteredLogsList.map((line, i) => renderLogLine(line, i))
                ) : (
                    <span className="text-gray-400 italic">No matching logs found</span>
                )}
            </div>
          ) : (
            <div className="text-gray-500 italic">{t.logs.noLogs}</div>
          )}
        </div>
      </Card>
    </div>
  )
}

