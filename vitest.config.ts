import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      // Same discovery rules as wrangler.jsonc, so migrations/seed.sql is skipped.
      const migrations = await readD1Migrations({
        projectPath: import.meta.dirname,
        migrationsDir: 'migrations',
        migrationsPattern: 'migrations/0*.sql',
      })
      return {
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }
    }),
  ],
  test: {
    setupFiles: ['./test/apply-migrations.ts'],
  },
})
