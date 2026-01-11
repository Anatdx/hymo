import { useStore } from '@/store'
import { X } from 'lucide-react'

export function ToastContainer() {
  const { toasts, removeToast } = useStore()

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            flex items-center justify-between gap-3 p-4 rounded-lg shadow-lg
            backdrop-blur-md border animate-slide-up
            ${toast.type === 'success' ? 'bg-green-600/90 border-green-500' : ''}
            ${toast.type === 'error' ? 'bg-red-600/90 border-red-500' : ''}
            ${toast.type === 'info' ? 'bg-blue-600/90 border-blue-500' : ''}
          `}
        >
          <p className="text-white text-sm font-medium">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  )
}
