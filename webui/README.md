# Hymo WebUI - React TypeScript Edition

A complete rewrite of the Hymo WebUI using modern web technologies.

## Tech Stack

- **React 18** - Modern UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Zustand** - Lightweight state management
- **Vite** - Fast build tool
- **Lucide React** - Beautiful icons

## Features

✨ **Modern UI/UX**
- Glassmorphism design
- Smooth animations
- Responsive layout
- Dark mode optimized

🌍 **Internationalization**
- English
- 简体中文
- Easy to extend

📱 **Mobile Optimized**
- Touch-friendly interface
- Swipe gestures
- Responsive breakpoints

⚡ **Performance**
- Fast loading
- Optimized bundle size
- Code splitting

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
webui/
├── src/
│   ├── components/     # Reusable UI components
│   │   ├── Navigation.tsx
│   │   ├── Toast.tsx
│   │   └── ui.tsx
│   ├── pages/          # Page components
│   │   ├── StatusPage.tsx
│   │   ├── ConfigPage.tsx
│   │   ├── ModulesPage.tsx
│   │   ├── LogsPage.tsx
│   │   └── InfoPage.tsx
│   ├── services/       # API layer
│   │   └── api.ts
│   ├── store/          # State management
│   │   └── index.ts
│   ├── i18n/           # Internationalization
│   │   └── index.ts
│   ├── types/          # TypeScript types
│   │   └── index.ts
│   ├── lib/            # Utilities
│   │   └── utils.ts
│   ├── App.tsx         # Main app component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Key Features

### 1. Status Page
- Real-time storage monitoring
- Active modules count
- System information
- Partition status

### 2. Config Page
- General settings
- Advanced options
- Custom partitions
- Background customization

### 3. Modules Page
- Search and filter
- Module management
- Hot mount/unmount
- Conflict detection
- Custom rules

### 4. Logs Page
- System logs
- Kernel logs
- Real-time refresh
- Terminal-style display

### 5. Info Page
- About Hymo
- Feature list
- Links to documentation
- Warning modal

## API Integration

The WebUI communicates with the native `hymod` binary through KernelSU's `exec` API:

```typescript
import { api } from '@/services/api'

// Load config
const config = await api.loadConfig()

// Save config
await api.saveConfig(config)

// Scan modules
const modules = await api.scanModules()

// Read logs
const logs = await api.readLogs('kernel', 1000)
```

## State Management

Using Zustand for simple and efficient state management:

```typescript
import { useStore } from '@/store'

function MyComponent() {
  const { config, updateConfig, saveConfig } = useStore()
  
  const handleChange = (value: string) => {
    updateConfig({ moduledir: value })
  }
  
  return <Input value={config.moduledir} onChange={handleChange} />
}
```

## Styling

Using Tailwind CSS for utility-first styling:

```tsx
<Card className="border-primary-500 bg-primary-600/10">
  <h3 className="text-xl font-bold text-white">Title</h3>
  <p className="text-gray-400">Description</p>
</Card>
```

## Build Output

The build process generates optimized files in `dist/`:

```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   ├── index-[hash].css
│   └── vendor-[hash].js
└── vite.svg
```

These files are copied to `module/webroot/` during the module build.

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Android WebView 90+

## License

GPL-3.0

---

**Note**: This is a complete rewrite with zero code reuse from the previous Svelte implementation.
