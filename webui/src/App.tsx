import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { Navigation } from '@/components/Navigation'
import { ToastContainer } from '@/components/Toast'
import { StatusPage } from '@/pages/StatusPage'
import { ConfigPage } from '@/pages/ConfigPage'
import { ModulesPage } from '@/pages/ModulesPage'
import { HymoFSPage } from '@/pages/HymoFSPage'
import { LogsPage } from '@/pages/LogsPage'
import { InfoPage } from '@/pages/InfoPage'
import { Card, Button } from '@/components/ui'
import { AlertTriangle } from 'lucide-react'

function App() {
  const activeTab = useStore((s) => s.activeTab)
  const backgroundImage = useStore((s) => s.backgroundImage)
  const initialize = useStore((s) => s.initialize)
  const t = useStore((s) => s.t)
  const theme = useStore((s) => s.theme)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const useSystemFont = useStore((s) => s.useSystemFont)
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(5)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (useSystemFont) {
        document.body.classList.add('use-system-font')
    } else {
        document.body.classList.remove('use-system-font')
    }
  }, [useSystemFont])
  
  const PAGES = ['status', 'config', 'modules', 'hymofs', 'logs', 'info'] as const
  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncTabRef = useRef<() => void>(() => {})
  const [visibleIndex, setVisibleIndex] = useState(0)
  const lastReportedIndexRef = useRef(0)

  const syncTabFromScroll = () => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const width = el.clientWidth
    const index = Math.round(el.scrollLeft / width)
    const newTab = PAGES[Math.max(0, Math.min(index, PAGES.length - 1))]
    if (newTab && newTab !== activeTab) {
      setActiveTab(newTab)
    }
  }
  syncTabRef.current = syncTabFromScroll

  useEffect(() => {
    const index = PAGES.indexOf(activeTab as any)
    if (index !== -1) {
      setVisibleIndex(index)
      lastReportedIndexRef.current = index
      if (scrollRef.current) {
        const width = scrollRef.current.clientWidth
        scrollRef.current.scrollTo({
          left: index * width,
          behavior: 'smooth'
        })
      }
    }
  }, [activeTab])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handler = () => {
      if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current)
      scrollEndTimerRef.current = null
      syncTabRef.current()
    }
    el.addEventListener('scrollend', handler)
    return () => el.removeEventListener('scrollend', handler)
  }, [])

  const onScroll = () => {
    if (scrollEndTimerRef.current) clearTimeout(scrollEndTimerRef.current)
    scrollEndTimerRef.current = setTimeout(() => syncTabRef.current(), 100)

    const el = scrollRef.current
    if (!el) return
    const width = el.clientWidth
    const idx = Math.round(el.scrollLeft / width)
    const clamped = Math.max(0, Math.min(idx, PAGES.length - 1))
    if (clamped !== lastReportedIndexRef.current) {
      lastReportedIndexRef.current = clamped
      setVisibleIndex(clamped)
    }
  }

  useEffect(() => {
    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    if (theme === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(media.matches)
      
      const listener = (e: MediaQueryListEvent) => applyTheme(e.matches)
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    } else {
      applyTheme(theme === 'dark')
    }
  }, [theme])

  useEffect(() => {
    initialize()

    const warningShown = localStorage.getItem('hymo_warning_shown')
    if (!warningShown) {
      setShowWarning(true)
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [initialize])

  const closeWarning = () => {
    if (countdown === 0) {
      localStorage.setItem('hymo_warning_shown', 'true')
      setShowWarning(false)
    }
  }

  return (
    <div
      className="h-screen flex flex-col bg-[#f2f4f6] dark:bg-[#0a0a0a] text-black dark:text-gray-100 transition-colors duration-300 overflow-hidden"
      style={{
        backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {backgroundImage && (
        <div className="fixed inset-0 bg-black/50" />
      )}
      
      <div className="relative flex flex-col h-full">
        <div className="flex-none z-40">
            <Navigation />
        </div>
        
        <div
            ref={scrollRef}
            className="flex-1 flex w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth"
            style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            onScroll={onScroll}
        >
            {PAGES.map((tab, idx) => {
              const isAdjacent = Math.abs(idx - visibleIndex) <= 2
              const shouldMount = isAdjacent
              return (
                <div key={tab} className="min-w-full w-full h-full overflow-y-auto overflow-x-hidden snap-start snap-always shrink-0 px-4 py-8 no-scrollbar">
                  <main className="max-w-7xl mx-auto">
                    {shouldMount && tab === 'status' && <StatusPage />}
                    {shouldMount && tab === 'config' && <ConfigPage />}
                    {shouldMount && tab === 'modules' && <ModulesPage />}
                    {shouldMount && tab === 'hymofs' && <HymoFSPage />}
                    {shouldMount && tab === 'logs' && <LogsPage />}
                    {shouldMount && tab === 'info' && <InfoPage />}
                  </main>
                </div>
              )
            })}
        </div>

        <ToastContainer />

        {showWarning && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="max-w-lg border-red-500 bg-red-600/10 w-full animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                    <AlertTriangle className="text-red-400" size={32} />
                    <h2 className="text-2xl font-bold text-red-400">{t.common.warning}</h2>
                </div>
                </div>

                <div className="space-y-4 mb-6">
                <div className="p-4 bg-red-900/20 rounded-lg border border-red-500/30">
                    <p className="text-gray-700 dark:text-gray-200 font-semibold mb-2">警告：</p>
                    <p className="text-gray-700 dark:text-gray-200">
                    HymoFS 是一个实验性项目。它可能会导致手机性能下降，并且可能存在潜在的稳定性问题。
                    </p>
                </div>

                <div className="p-4 bg-red-900/20 rounded-lg border border-red-500/30">
                    <p className="text-gray-700 dark:text-gray-200 font-semibold mb-2">Warning:</p>
                    <p className="text-gray-700 dark:text-gray-200">
                    HymoFS is an experimental project. It may cause performance degradation and potential stability issues.
                    </p>
                </div>
                </div>

                <Button
                onClick={closeWarning}
                disabled={countdown > 0}
                className="w-full"
                size="lg"
                >
                {countdown > 0 ? `Please wait (${countdown}s)` : 'I Understand / 我知道了'}
                </Button>
            </Card>
            </div>
        )}
      </div>
    </div>
  )
}

export default App
