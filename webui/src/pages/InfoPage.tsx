import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { Card, Button } from '@/components/ui'
import { Github, BookOpen, AlertTriangle } from 'lucide-react'

export function InfoPage() {
  const { t } = useStore()
  const [showWarning, setShowWarning] = useState(false)
  const [countdown, setCountdown] = useState(5)

  useEffect(() => {
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
  }, [])

  const closeWarning = () => {
    if (countdown === 0) {
      localStorage.setItem('hymo_warning_shown', 'true')
      setShowWarning(false)
    }
  }

  return (
    <div className="space-y-6">
      {showWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-lg border-red-500 bg-red-600/10">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-red-400" size={32} />
                <h2 className="text-2xl font-bold text-red-400">⚠️ {t.common.error}</h2>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-red-900/20 rounded-lg border border-red-500/30">
                <p className="text-white font-semibold mb-2">中文警告：</p>
                <p className="text-gray-200">
                  HymoFS 是一个实验性项目。它可能会导致手机性能下降，并且可能存在潜在的稳定性问题。
                </p>
              </div>

              <div className="p-4 bg-red-900/20 rounded-lg border border-red-500/30">
                <p className="text-white font-semibold mb-2">English Warning:</p>
                <p className="text-gray-200">
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

      <Card>
        <div className="flex items-center gap-4 mb-6">
          <img src="/icon.svg" className="w-16 h-16 rounded-2xl" alt="Logo" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Hymo</h1>
            <p className="text-gray-500 dark:text-gray-400">{t.info.description}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-white/10">
            <span className="text-gray-500 dark:text-gray-400">{t.info.version}</span>
            <span className="text-gray-900 dark:text-white font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-500 dark:text-gray-400">License</span>
            <span className="text-gray-900 dark:text-white">GPL-3.0</span>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t.info.links}</h3>
        <div className="space-y-3">
          <Button
            variant="secondary"
            className="w-full justify-start h-[50px]"
            onClick={() => window.open('https://github.com/Anatdx/hymo', '_blank')}
          >
            <Github size={20} className="mr-3" />
            {t.info.github}
          </Button>
          
          <Button
            variant="secondary"
            className="w-full justify-start h-[50px]"
            onClick={() => window.open('https://github.com/Anatdx/hymo/blob/main/README.md', '_blank')}
          >
            <BookOpen size={20} className="mr-3" />
            {t.info.docs}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">{t.info.acknowledgments}</h3>
        <div className="flex flex-col gap-2">
          {[
              { name: 'KernelSU', url: 'https://kernelsu.org' },
              { name: 'Magisk', url: 'https://github.com/topjohnwu/Magisk' },
              { name: 'React', url: 'https://react.dev' },
              { name: 'Vite', url: 'https://vitejs.dev' },
              { name: 'Tailwind CSS', url: 'https://tailwindcss.com' },
              { name: 'Zustand', url: 'https://github.com/pmndrs/zustand' },
              { name: 'Lucide Icons', url: 'https://lucide.dev' }
          ].map((item) => (
             <Button
                key={item.name}
                variant="secondary"
                className="w-full justify-between group h-[50px]"
                onClick={() => window.open(item.url, '_blank')}
              >
                  <span className="font-medium text-gray-700 dark:text-gray-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {item.name}
                  </span>
                  <div className="text-gray-400 group-hover:text-primary-500 transition-colors">
                      ↗
                  </div>
              </Button>
          ))}
        </div>
      </Card>
    </div>
  )
}
