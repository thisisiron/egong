import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // e2e/는 Playwright 소유다. 제외하지 않으면 Vitest가 *.spec.ts를 집어가 충돌한다.
    exclude: ['node_modules/**', 'e2e/**', '.next/**'],
  },
})
