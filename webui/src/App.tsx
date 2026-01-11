import { useEffect } from 'react'
import { useStore } from '@/store'
import { Navigation } from '@/components/Navigation'
import { ToastContainer } from '@/components/Toast'
import { StatusPage } from '@/pages/StatusPage'
import { ConfigPage } from '@/pages/ConfigPage'
import { ModulesPage } from '@/pages/ModulesPage'
import { LogsPage } from '@/pages/LogsPage'
import { InfoPage } from '@/pages/InfoPage'

function App() {
  const { activeTab, backgroundImage, initialize } = useStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  const renderPage = () => {
    switch (activeTab) {
      case 'status':
        return <StatusPage />
      case 'config':
        return <ConfigPage />
      case 'modules':
        return <ModulesPage />
      case 'logs':
        return <LogsPage />
      case 'info':
        return <InfoPage />
      default:
        return <StatusPage />
    }
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white"
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
      
      <div className="relative">
        <Navigation />
        
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-fade-in">
            {renderPage()}
          </div>
        </main>

        <ToastContainer />
      </div>
    </div>
  )
}

export default App
