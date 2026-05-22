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
  },
});
