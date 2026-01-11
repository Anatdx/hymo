import { type ClassValue, clsx } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

export function formatBytes(bytes: string): string {
  if (bytes === '-') return bytes
  const num = parseInt(bytes)
  if (isNaN(num)) return bytes
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = num
  let unitIndex = 0
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }
  
  return `${size.toFixed(1)}${units[unitIndex]}`
}
