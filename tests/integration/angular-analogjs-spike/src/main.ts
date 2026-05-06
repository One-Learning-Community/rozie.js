// Phase 5 Plan 05-03 OQ3 spike — manual `vite dev` entrypoint (NOT used by
// the spike test, which boots its own programmatic Vite server). This file
// exists so `pnpm -F rozie-angular-analogjs-spike dev` is runnable for
// hand-debugging if the vitest probe surfaces something subtle.
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';

// @ts-expect-error — synthetic id resolved by synthetic-resolver-plugin.ts
import { SyntheticComponent } from 'synthetic.rozie.ts';

bootstrapApplication(SyntheticComponent).catch(console.error);
