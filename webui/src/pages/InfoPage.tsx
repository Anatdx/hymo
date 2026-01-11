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
      {/* Warning Modal */}
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

      {/* About Card */}
      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center">
            <span className="text-white font-bold text-3xl">H</span>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Hymo</h1>
            <p className="text-gray-400">{t.info.description}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-white/10">
            <span className="text-gray-400">{t.info.version}</span>
            <span className="text-white font-mono">1.0.0</span>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-400">License</span>
            <span className="text-white">GPL-3.0</span>
          </div>
        </div>
      </Card>

      {/* Warning Card */}
      <Card className="border-yellow-500 bg-yellow-600/10">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-yellow-400 flex-shrink-0" size={24} />
          <div>
            <h4 className="text-yellow-400 font-semibold mb-2">{t.common.error}</h4>
            <p className="text-gray-300 text-sm">{t.info.warning}</p>
          </div>
        </div>
      </Card>

      {/* Features */}
      <Card>
        <h3 className="text-xl font-bold text-white mb-4">Core Features</h3>
        <ul className="space-y-2 text-gray-300">
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <span>Native C++ Engine for optimal performance</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <span>HymoFS kernel-level file system mapping</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <span>Multi-mode mounting (HymoFS/OverlayFS/Magic)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <span>Tmpfs-based in-memory module storage</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <span>Hot mount/unmount support</span>
          </li>
        </ul>
      </Card>

      {/* Links */}
      <Card>
        <h3 className="text-xl font-bold text-white mb-4">{t.info.links}</h3>
        <div className="space-y-3">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => window.open('https://github.com/Anatdx/HymoFS', '_blank')}
          >
            <Github size={20} className="mr-3" />
            {t.info.github}
          </Button>
          
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => window.open('https://github.com/Anatdx/HymoFS/blob/main/README.md', '_blank')}
          >
            <BookOpen size={20} className="mr-3" />
            {t.info.docs}
          </Button>
        </div>
      </Card>

      {/* Tech Stack */}
      <Card>
        <h3 className="text-xl font-bold text-white mb-4">Tech Stack</h3>
        <div className="flex flex-wrap gap-2">
          {['React', 'TypeScript', 'Tailwind CSS', 'Zustand', 'Vite', 'KernelSU'].map((tech) => (
            <span
              key={tech}
              className="px-3 py-1 bg-primary-600/20 border border-primary-500/30 rounded-lg text-primary-300 text-sm"
            >
              {tech}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
