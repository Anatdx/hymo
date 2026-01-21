import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// 读取 module.prop 中的版本信息
function getModuleVersion() {
  const propPath = path.resolve(__dirname, '../module/module.prop')
  const content = fs.readFileSync(propPath, 'utf-8')
  const versionMatch = content.match(/^version=(.+)$/m)
  const versionCodeMatch = content.match(/^versionCode=(.+)$/m)
  return {
    version: versionMatch ? versionMatch[1] : 'unknown',
    versionCode: versionCodeMatch ? versionCodeMatch[1] : '0',
  }
}

const moduleInfo = getModuleVersion()

export default defineConfig({
  plugins: [react()],
  define: {
    __MODULE_VERSION__: JSON.stringify(moduleInfo.version),
    __MODULE_VERSION_CODE__: JSON.stringify(moduleInfo.versionCode),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0', // 监听所有网络接口
    port: 8080,
    strictPort: false,
    open: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          store: ['zustand'],
        },
      },
    },
  },
})
