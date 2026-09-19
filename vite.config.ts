/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// @ts-expect-error server config not typed
const serverConfig = {
  allowedHosts: ['localhost', '.coulet.me'],
}

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: serverConfig,
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx', 'src/**/*.test.ts'],
  },
})
