import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "./src"),
      },
    },
    // Ensure Vite properly passes through environment variables
    define: {
      'process.env': { ...process.env, ...env }
    },
    // Optimize dependencies for production
    build: {
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            charts: ['recharts'],
            utils: ['lodash', 'date-fns', 'moment-timezone']
          }
        }
      }
    },
    // Development server configuration
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      origin: 'http://localhost:5173'
    },
    // Base URL for production
    base: '/',
    // Enable source maps in production for better error tracking
    esbuild: {
      drop: mode === 'production' ? ['console', 'debugger'] : []
    }
  }
})