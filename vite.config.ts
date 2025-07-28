import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import csp from 'vite-plugin-csp'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath( import.meta.url )
const __dirname = path.dirname( __filename )

// https://vitejs.dev/config/
export default defineConfig( {
  root: 'client',
  plugins: [
    react(),
    csp( {
      policy: {
        'script-src': [ 'self', 'unsafe-inline' ],
      },
    } ),
  ],
  resolve: {
    alias: {
      '@': path.resolve( __dirname, 'client/src' ),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
} )
