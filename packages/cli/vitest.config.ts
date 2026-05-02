// Vitest config for @rozie/cli.
// Pinned `root: __dirname` so snapshot path resolution is stable whether
// invoked from the package dir or via `pnpm --filter @rozie/cli test`.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    root: __dirname,
  },
});
