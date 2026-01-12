import { useState, useRef, useEffect } from 'react'
import { useStore } from '@/store'
import { Activity, Settings, Package, FileText, Info, Globe, Moon, Sun, SunMoon } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'status' as const, icon: Activity, label: 'nav.status' },
  { id: 'config' as const, icon: Settings, label: 'nav.config' },
  { id: 'modules' as const, icon: Package, label: 'nav.modules' },
  { id: 'logs' as const, icon: FileText, label: 'nav.logs' },
  { id: 'info' as const, icon: Info, label: 'nav.info' },
]

export function Navigation() {
  const { activeTab, setActiveTab, t, language, setLanguage, theme, toggleTheme } = useStore()
  const [isLangOpen, setIsLangOpen] = useState(false)
  const langRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <nav className="sticky top-0 z-40 bg-white/70 dark:bg-black/30 backdrop-blur-lg border-b border-gray-200 dark:border-white/10 transition-colors duration-300 pt-[var(--top-inset)]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2 flex-shrink-0">
          </div>

          <div className="flex items-center gap-1 flex-1 mx-2 overflow-x-auto no-scrollbar mask-gradient justify-start">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-all min-w-[44px]',
                    isActive
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/30'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-white'
                  )}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span className="hidden md:inline text-sm font-medium truncate max-w-[80px]">
                    {t.nav[tab.label.split('.')[1] as keyof typeof t.nav]}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white transition-all"
              title={theme === 'system' ? 'System Theme' : theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            >
              {theme === 'system' ? <SunMoon size={18} /> : theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <div className="relative" ref={langRef}>
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-700 dark:text-white transition-all"
              >
                <Globe size={18} />
              </button>

              {isLangOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-white/10 rounded-xl shadow-xl overflow-hidden py-1 z-50 animate-fade-in max-h-[300px] overflow-y-auto">
                  {[
                      { code: 'en', label: 'English' },
                      { code: 'zh-CN', label: '简体中文' },
                      { code: 'zh-TW', label: '繁體中文' },
                      { code: 'fr', label: 'Français' },
                      { code: 'es', label: 'Español' },
                      { code: 'ja', label: '日本語' },
                      { code: 'ko', label: '한국어' },
                      { code: 'ru', label: 'Русский' },
                      { code: 'ar', label: 'العربية' },
                  ].map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code as any)
                          setIsLangOpen(false)
                        }}
                        className={cn(
                          'w-full text-left px-4 py-2 text-sm transition-colors',
                          language === lang.code
                            ? 'bg-primary-50 dark:bg-primary-600/20 text-primary-600 dark:text-primary-400 font-medium'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5'
                        )}
                      >
                        {lang.label}
                      </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
