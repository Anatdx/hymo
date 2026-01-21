/// <reference types="vite/client" />

declare const __MODULE_VERSION__: string
declare const __MODULE_VERSION_CODE__: string

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
