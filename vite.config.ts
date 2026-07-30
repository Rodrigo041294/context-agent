import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // Node 26 ships a native `localStorage` global (--experimental-webstorage, on by
    // default) that is undefined without --localstorage-file. Vitest's jsdom environment
    // only overrides globals it doesn't already find on `global`, so the native stub
    // wins over jsdom's working implementation unless disabled here.
    execArgv: ['--no-experimental-webstorage'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts',
        'src/main.tsx',
        'src/types/**',
        'vite.config.ts',
        '**/*.d.ts',
      ],
    },
  },
})
