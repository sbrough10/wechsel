import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src/client'),
      '@shared': path.resolve(process.cwd(), 'src/shared'),
      '@server': path.resolve(process.cwd(), 'src/server'),
    },
  },
})
