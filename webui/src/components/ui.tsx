import type { HTMLAttributes, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl backdrop-blur-md',
        'bg-white dark:bg-white/5',
        'border border-gray-200 dark:border-white/10',
        'shadow-sm dark:shadow-lg p-6 transition-all',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  const variants = {
    primary: 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm shadow-primary-500/20 active:scale-95',
    secondary: 'bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white active:scale-95',
    danger: 'bg-red-600 hover:bg-red-700 text-white active:scale-95',
    success: 'bg-green-600 hover:bg-green-700 text-white active:scale-95',
    ghost: 'bg-transparent hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-white active:scale-95',
  }

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  }

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2',
        'rounded-lg font-medium transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
}

export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer group active:scale-[0.99] transition-transform">
      {label && <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>}
      <div
        className={cn(
          'relative w-11 h-6 rounded-full transition-colors duration-300',
          checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !disabled && onChange(!checked)}
      >
        <div
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform duration-300 shadow-sm',
            checked && 'transform translate-x-5'
          )}
        />
      </div>
    </label>
  )
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>}
      <input
        className={cn(
          'w-full px-3 py-2 rounded-lg',
          'bg-white dark:bg-white/5',
          'border border-gray-200 dark:border-white/20',
          'text-gray-900 dark:text-white',
          'placeholder-gray-400 dark:placeholder-gray-500',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          'transition-all duration-200',
          error && 'border-red-500',
          className
        )}
        {...props}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <div className="space-y-1">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>}
      <div className="relative">
      <select
        className={cn(
          'w-full px-3 py-2 rounded-lg appearance-none',
          'bg-white dark:bg-white/5',
          'border border-gray-200 dark:border-white/20',
          'text-gray-900 dark:text-white',
          'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
          'transition-all duration-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/10',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className={cn("bg-white dark:bg-gray-800 text-gray-900 dark:text-white", opt.disabled && "text-gray-400 dark:text-gray-600")} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      </div>
    </div>
  )
}

interface RadioCardsProps {
  options: Array<{ value: string; label: string; icon?: ReactNode; disabled?: boolean; description?: string }>
  value: string
  onChange: (value: string) => void
  label?: string
}

export function RadioCards({ options, value, onChange, label }: RadioCardsProps) {
  return (
    <div className="space-y-3">
      {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">{label}</label>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((opt) => {
          const isSelected = value === opt.value
          return (
            <div
              key={opt.value}
              onClick={() => !opt.disabled && onChange(opt.value)}
              className={cn(
                "relative flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all duration-200",
                isSelected 
                  ? "border-primary-500 bg-primary-50 dark:bg-primary-900/10" 
                  : "border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-gray-300 dark:hover:border-white/20",
                 opt.disabled && "opacity-50 cursor-not-allowed grayscale"
              )}
            >
              <div className="flex-1 min-w-0">
                 <div className={cn("font-medium truncate", isSelected ? "text-primary-700 dark:text-primary-400" : "text-gray-900 dark:text-gray-100")}>
                   {opt.label}
                 </div>
                 {opt.description && (
                   <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                     {opt.description}
                   </div>
                 )}
              </div>
              <div className={cn(
                "ml-3 w-5 h-5 rounded-full border flex items-center justify-center transition-colors",
                isSelected ? "border-primary-600 bg-primary-600" : "border-gray-400 dark:border-gray-500"
              )}>
                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface BadgeProps {
  children: ReactNode
  variant?: 'default' | 'success' | 'warning' | 'danger'
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variants = {
    default: 'bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white',
    success: 'bg-green-100 dark:bg-green-600 text-green-800 dark:text-white',
    warning: 'bg-yellow-100 dark:bg-yellow-600 text-yellow-800 dark:text-black',
    danger: 'bg-red-100 dark:bg-red-600 text-red-800 dark:text-white',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse bg-gray-200 dark:bg-white/10 rounded', className)}
    />
  )
}
