import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // e2e/는 Playwright 소유다. 제외하지 않으면 Vitest가 *.spec.ts를 집어가 충돌한다.
    exclude: ['node_modules/**', 'e2e/**', '.next/**'],
  },
})
