import { useStore } from '@/store'
import { Activity, Settings, Package, FileText, Info, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'status' as const, icon: Activity, label: 'nav.status' },
  { id: 'config' as const, icon: Settings, label: 'nav.config' },
  { id: 'modules' as const, icon: Package, label: 'nav.modules' },
  { id: 'logs' as const, icon: FileText, label: 'nav.logs' },
  { id: 'info' as const, icon: Info, label: 'nav.info' },
]

export function Navigation() {
  const { activeTab, setActiveTab, t, language, setLanguage } = useStore()

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'zh-CN' : 'en')
  }

  return (
    <nav className="sticky top-0 z-40 bg-black/30 backdrop-blur-lg border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <span className="text-white font-bold text-xl">Hymo</span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-all',
                    isActive
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-300 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Icon size={18} />
                  <span className="hidden sm:inline text-sm font-medium">
                    {t.nav[tab.label.split('.')[1] as keyof typeof t.nav]}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Language Toggle */}
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
          >
            <Globe size={18} />
            <span className="text-sm font-medium">{language === 'en' ? 'EN' : '中文'}</span>
          </button>
        </div>
      </div>
    </nav>
  )
}
