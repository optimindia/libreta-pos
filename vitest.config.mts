import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    // Los tests de UI comparten la instancia de Dexie fake; en paralelo una
    // prueba puede borrar la base mientras otra todavía termina una query.
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
})
