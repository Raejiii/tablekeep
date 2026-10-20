import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
    resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
    test: {
        // unit tests run everywhere; the RLS suite needs a running Supabase stack
        include: process.env.INTEGRATION ? ['tests/**/*.test.ts'] : ['src/**/*.test.ts'],
    },
})
