import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3008,
    open: true,
    fs: {
      strict: false
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
    dedupe: ['sats-connect']
  },
  publicDir: resolve(__dirname, 'public'),
  optimizeDeps: {
    include: ['sats-connect']
  },
  build: {
    commonjsOptions: {
      include: [/sats-connect/, /node_modules/]
    }
  }
})

