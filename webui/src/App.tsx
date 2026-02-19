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
  const { activeTab, backgroundImage, initialize, t, theme, setActiveTab, useSystemFont } = useStore()
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
  
  const touchStartRef = useRef<{ x: number, y: number, scrollLeft: number } | null>(null)
  const isLockedVerticalRef = useRef(false)
  const isDraggingHorizontalRef = useRef(false)

  const onTouchStart = (e: React.TouchEvent) => {
    if (!scrollRef.current) return
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      scrollLeft: scrollRef.current.scrollLeft
    }
    isLockedVerticalRef.current = false
    isDraggingHorizontalRef.current = false
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    
    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    
    const dx = currentX - touchStartRef.current.x
    const dy = currentY - touchStartRef.current.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    if (!isDraggingHorizontalRef.current && !isLockedVerticalRef.current) {
        if (absDx < 10 && absDy < 10) return
    }

    if (!isDraggingHorizontalRef.current && !isLockedVerticalRef.current) {
        if (absDy > absDx * 1.5) {
            isLockedVerticalRef.current = true
            return
        }
        isDraggingHorizontalRef.current = true
    }
    
    if (isLockedVerticalRef.current) return

    if (isDraggingHorizontalRef.current && scrollRef.current) {
        const newScroll = touchStartRef.current.scrollLeft - dx
        const maxScroll = scrollRef.current.scrollWidth - scrollRef.current.clientWidth
        scrollRef.current.scrollLeft = Math.max(0, Math.min(newScroll, maxScroll))
    }
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    if (isDraggingHorizontalRef.current && scrollRef.current && touchStartRef.current) {
        const width = scrollRef.current.clientWidth
        const activeIndex = PAGES.indexOf(activeTab as any)
        
        const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x
        
        let targetIndex = activeIndex

        if (deltaX < -width * 0.2) {
             targetIndex = Math.min(activeIndex + 1, PAGES.length - 1)
        } else if (deltaX > width * 0.2) {
             targetIndex = Math.max(0, activeIndex - 1)
        }

        scrollRef.current.scrollTo({
            left: targetIndex * width,
            behavior: 'smooth'
        })
        
        if (targetIndex !== activeIndex) {
            setActiveTab(PAGES[targetIndex])
        }
    }
    
    touchStartRef.current = null
    isLockedVerticalRef.current = false
    isDraggingHorizontalRef.current = false
  }

  const PAGES = ['status', 'config', 'modules', 'hymofs', 'logs', 'info'] as const

  useEffect(() => {
    const index = PAGES.indexOf(activeTab as any)
    if (index !== -1 && scrollRef.current) {
        const width = scrollRef.current.clientWidth
        scrollRef.current.scrollTo({
            left: index * width,
            behavior: 'smooth'
        })
    }
  }, [activeTab])

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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      )}
      
      <div className="relative flex flex-col h-full">
        <div className="flex-none z-40">
            <Navigation />
        </div>
        
        <div 
            ref={scrollRef}
            className="flex-1 flex w-full overflow-x-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <div className="min-w-full w-full h-full overflow-y-auto px-4 py-8 no-scrollbar">
                <main className="max-w-7xl mx-auto animate-fade-in">
                    <StatusPage />
                </main>
            </div>

            <div className="min-w-full w-full h-full overflow-y-auto px-4 py-8 no-scrollbar">
                <main className="max-w-7xl mx-auto animate-fade-in">
                    <ConfigPage />
                </main>
            </div>

            {/* Modules Page */}
            <div className="min-w-full w-full h-full overflow-y-auto px-4 py-8 no-scrollbar">
                <main className="max-w-7xl mx-auto animate-fade-in">
                    <ModulesPage />
                </main>
            </div>

            {/* HymoFS Page */}
            <div className="min-w-full w-full h-full overflow-y-auto px-4 py-8 no-scrollbar">
                <main className="max-w-7xl mx-auto animate-fade-in">
                    <HymoFSPage />
                </main>
            </div>

            <div className="min-w-full w-full h-full overflow-y-auto px-4 py-8 no-scrollbar">
                <main className="max-w-7xl mx-auto animate-fade-in">
                    <LogsPage />
                </main>
            </div>

            <div className="min-w-full w-full h-full overflow-y-auto px-4 py-8 no-scrollbar">
                <main className="max-w-7xl mx-auto animate-fade-in">
                    <InfoPage />
                </main>
            </div>
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
