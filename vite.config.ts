import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    cloudflare(),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src/client'),
      '@shared': path.resolve(process.cwd(), 'src/shared'),
      '@server': path.resolve(process.cwd(), 'src/server'),
    },
  },
})
