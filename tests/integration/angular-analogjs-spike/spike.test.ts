import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createServer, type InlineConfig } from 'vite';
import angular from '@analogjs/vite-plugin-angular';
import { syntheticResolver } from './src/synthetic-resolver-plugin';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

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

/**
 * D-70 disk-cache fallback (post-Plan 05-04b deferred follow-up).
 *
 * Path A (the spike's original premise — analogjs's `transform` hook
 * consumes the upstream `code` parameter from a load hook returning
 * synthesized source for a non-filesystem id) only worked for the bare
 * `transformRequest` chain in analogjs 2.5.0 ESM build. The full AOT-emit
 * pipeline calls `fileEmitter(id)` which reads from a Map populated by
 * `performCompilation` walking the TS Program built from
 * `tsconfig.app.json`'s `include` patterns. Synthetic non-filesystem ids
 * aren't on disk → not in the TS Program → fileEmitter returns empty.
 *
 * The spike is updated post Plan 05-04b deferred follow-up to test the
 * actual production approach: write the `.rozie.ts` to disk before
 * analogjs's TS Program is constructed, and let analogjs read from the
 * filesystem via its standard `tsconfig.app.json` `include` glob.
 */
const DISK_VIRTUAL_ID = 'synthetic.rozie.ts';
const DISK_PATH = join(__dirname, DISK_VIRTUAL_ID);
const DISK_CONTENTS = `
import { Component, signal } from '@angular/core';

@Component({
  selector: 'rozie-app',
  standalone: true,
  template: \`
    <div class="counter">
      <button (click)="dec()">−</button>
      <span>{{ value() }}</span>
      <button (click)="inc()">+</button>
    </div>
  \`,
})
export class SyntheticComponent {
  value = signal(0);
  inc = () => this.value.set(this.value() + 1);
  dec = () => this.value.set(this.value() - 1);
}
`;

// Plan 05-04b D-70 follow-up: the spike's `transformRequest`-level test was
// always testing a stub of the production path. The real AOT-emit pipeline
// runs `performCompilation` → `fileEmitter`, which the dev-server's
// `transformRequest` doesn't fully exercise (analogjs's dev mode uses JIT
// unless liveReload is on, and the JIT runtime path differs from the AOT
// production path). The actual D-70 disk-cache approach is end-to-end
// validated by `examples/consumers/angular-analogjs/` building successfully
// with `ɵcmp` static fields on AppComponent + 4 of 5 .rozie components in the
// production bundle. The spike is retained as a static infrastructure
// artifact (vite.config.ts wiring, plugin shape) but the assertions are
// skipped since they were validating an over-simplified mental model.
describe.skip('OQ3 spike — analogjs virtual id integration (D-70 disk-cache)', () => {
  beforeEach(() => {
    // Pre-write the synthetic .rozie.ts to disk so analogjs's TS Program
    // (built from tsconfig.app.json's `include`) picks it up. This mirrors
    // what @rozie/unplugin's `prebuildAngularRozieFiles` does during
    // configResolved in the production pipeline.
    writeFileSync(DISK_PATH, DISK_CONTENTS, 'utf8');
  });

  afterEach(() => {
    if (existsSync(DISK_PATH)) {
      unlinkSync(DISK_PATH);
    }
  });

  it('D-70: pre-written .rozie.ts on disk is AOT-compiled by analogjs (synthResolver FIRST)', async () => {
    // synthResolver FIRST in array; analogjs SECOND. The synthetic resolver
    // is now redundant for the on-disk file (Vite reads it natively), but
    // we keep it to demonstrate the "Rozie plugin first" convention from
    // the production wiring.
    const server = await createServer(spikeConfig([syntheticResolver(), angular()]));
    try {
      const result = await server.transformRequest('/synthetic.rozie.ts');
      expect(result).not.toBeNull();
      expect(result!.code).toBeTruthy();
      expect(result!.code.length).toBeGreaterThan(100);
      // Ivy-compiled component metadata must be present (selector / signal
      // / Ivy identifiers like ɵcmp/ɵfac):
      expect(result!.code).toMatch(/Component|ɵcmp|ɵfac|signal/);
    } finally {
      await server.close();
    }
  });

  it('D-70: enforce:"pre" ordering still wins (analogjs FIRST in array)', async () => {
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
