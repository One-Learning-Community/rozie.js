// Vitest config for rozie-plugin-swipe-test (MOD-05 dogfood).
// Plain node env — these tests exercise compiler emitters, not browser APIs.
// Per RESEARCH.md §"Pitfall 8": anchor `test.root` to __dirname for stable
// snapshot path resolution across CWD variations.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    root: __dirname,
  },
});
