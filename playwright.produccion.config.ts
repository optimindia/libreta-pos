import { defineConfig, devices } from '@playwright/test'

// E2E offline-first contra el build de producción (`next build` + `next start`).
// A diferencia de playwright.config.ts (next dev, modo local sin cuentas), acá
// la puerta SaaS está activa tal cual sale a producción: la sesión y la nube se
// simulan con rutas (nunca hay red real). Requiere `next build` previo, con
// NEXT_PUBLIC_SUPABASE_URL=https://falso.supabase.co y
// NEXT_PUBLIC_SUPABASE_ANON_KEY=falsa (así lo hace el CI; `npm run test:e2e:prod`
// también lo hace en local).
export default defineConfig({
  testDir: './tests/e2e-produccion',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  // El mismo `.next` lo usan `next dev` y `next start`: esta suite corre sola.
  use: { baseURL: 'http://localhost:3101', ...devices['Pixel 7'] },
  webServer: {
    command: 'npx next start -p 3101',
    url: 'http://localhost:3101',
    timeout: 120000,
    reuseExistingServer: false,
  },
})
