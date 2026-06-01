// Vitest config for rozie-plugin-phone-test (Phase 12 model-modifier dogfood).
// Plain node env — these tests exercise compiler emitters, not browser APIs.
// Anchor `test.root` to __dirname for stable path resolution across CWD
// variations (mirrors tests/plugins/swipe).
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    root: __dirname,
    // Per-target emit tests run full .rozie → framework compiles across six
    // targets. Under `turbo run test` parallel CPU starvation that work can
    // exceed vitest's 5s default and flake only in full batteries (passes
    // standalone). A 30s ceiling is a load-tolerant FAILSAFE, not an assertion.
    testTimeout: 30000,
  },
});
