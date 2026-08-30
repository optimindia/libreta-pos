import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  // Puerto 3100 y no 3000: en este servidor el 3000 lo ocupa Easypanel.
  use: { baseURL: 'http://localhost:3100', ...devices['Pixel 7'] },
  webServer: {
    command: 'npx next start -p 3100',
    url: 'http://localhost:3100',
    timeout: 180000,
    reuseExistingServer: false,
  },
})
