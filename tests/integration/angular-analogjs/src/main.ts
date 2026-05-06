// Phase 5 success criterion #3 — proves examples/Counter.rozie compiles via
// @rozie/unplugin (target:'angular') + @analogjs/vite-plugin-angular and
// type-checks under Angular's strictTemplates: true.
//
// Plan 05-05 Wave 3 wires this into a CI workflow (.github/workflows/angular-matrix.yml).

import 'zone.js';

// @ts-expect-error — declared at runtime via vite alias '@examples' + path-virtual id
import Counter from '@examples/Counter.rozie';

export { Counter };
