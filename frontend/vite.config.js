import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Dev proxy — active only with `npm run dev`.
  // In production (Vercel) set VITE_API_URL to your Render backend URL.
  server: {
    proxy: {
      '/predict': 'http://localhost:8000',
      '/records': 'http://localhost:8000',
      '/trends':  'http://localhost:8000',
      '/chat':    'http://localhost:8000',
      '/health':  'http://localhost:8000',
    }
  },

  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'recharts':     ['recharts'],
        }
      }
    }
  }
})
