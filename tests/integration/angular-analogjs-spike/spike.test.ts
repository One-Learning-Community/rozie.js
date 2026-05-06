import { describe, it, expect } from 'vitest';
import { createServer, type InlineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { syntheticResolver } from './src/synthetic-resolver-plugin';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build a minimal Vite InlineConfig for the spike. The `optimizeDeps`
 * disabling is critical: Vite's dep-scanner eagerly walks `index.html` +
 * `src/main.ts` looking for bare imports to pre-bundle. `src/main.ts`
 * imports `'synthetic.rozie.ts'` which is unresolvable to esbuild's scanner
 * (the resolver runs at the rollup-plugin layer, not in esbuild). Disabling
 * the scanner avoids that and isolates the spike to the resolveId →
 * load → transform chain we care about.
 */
function spikeConfig(plugins: InlineConfig['plugins']): InlineConfig {
  return {
    root: __dirname,
    logLevel: 'silent',
    appType: 'custom',
    plugins,
    configFile: false,
    server: { middlewareMode: true },
    optimizeDeps: {
      noDiscovery: true,
      // Empty `include` + noDiscovery prevents the esbuild dep-scan from
      // crawling project files for bare imports.
      include: [],
    },
    cacheDir: 'node_modules/.vite-spike',
  };
}

describe('OQ3 spike — analogjs virtual id integration', () => {
  it('Path A: synthetic .rozie.ts resolves and analogjs consumes upstream code (synthResolver FIRST)', async () => {
    // synthResolver FIRST in array; analogjs SECOND.
    const server = await createServer(spikeConfig([syntheticResolver(), angular()]));
    try {
      // Programmatically request the synthetic id through Vite's
      // resolve/load/transform chain.
      const result = await server.transformRequest('/synthetic.rozie.ts');
      expect(result).not.toBeNull();
      // The transformed code should contain Ivy-compiled component metadata
      // (analogjs invokes Angular's compiler on the upstream `code`).
      expect(result!.code).toBeTruthy();
      expect(result!.code.length).toBeGreaterThan(100);
      // Must contain compiled Angular component artifacts (selector, signal,
      // or Ivy-compiled identifiers like ɵcmp/ɵfac):
      expect(result!.code).toMatch(/Component|ɵcmp|ɵfac|signal/);
    } finally {
      await server.close();
    }
  });

  it('Path A — order does not matter when synthResolver has enforce:"pre" (analogjs FIRST in array)', async () => {
    // Verify Pitfall 1 / RESEARCH A11 — enforce:'pre' wins regardless of
    // array order; Rozie can document "Rozie first" as the conventional
    // signal even though the load-bearing mechanism is enforce:'pre'.
    const server = await createServer(spikeConfig([angular(), syntheticResolver()])); // REVERSED
    try {
      const result = await server.transformRequest('/synthetic.rozie.ts');
      expect(result).not.toBeNull();
      expect(result!.code).toMatch(/Component|ɵcmp|ɵfac|signal/);
    } finally {
      await server.close();
    }
  });
});
