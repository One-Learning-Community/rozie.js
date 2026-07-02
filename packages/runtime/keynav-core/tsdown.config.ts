// tsdown bundler config for @rozie/runtime-keynav-core.
// Per D-95 (Phase 6 OQ2 resolution): dual ESM+CJS + d.ts via Oxc isolated-decl.
// Zero deps, zero `external` entries — this package is pure TS with no
// framework or DOM-global dependency (SPEC §8 / Phase 71 Plan 03).
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
});
