// Phase 5 success criterion #3 / ANGULAR-06 — analogjs CI integration.
//
// This integration project proves that:
//   1. examples/Counter.rozie compiles via @rozie/unplugin (target:'angular')
//   2. The compiled output type-checks under Angular's strictTemplates: true
//   3. @analogjs/vite-plugin-angular consumes the synthetic .rozie.ts virtual
//      id (Plan 05-03 SPIKE Path A confirmed in production by Plan 05-04b)
//   4. The full Vite build pipeline (Rozie's enforce:'pre' configResolved
//      disk-cache + analogjs's TS Program walk) produces a real AOT-compiled
//      Counter component in the bundle (ɵcmp=Cs({...,selectors:[["rozie-counter"]],...}))
//
// Plan 05-05 Task 2 wires this into .github/workflows/angular-matrix.yml
// integration-build job which runs `pnpm -F rozie-angular-analogjs-integration
// build` against Angular 17 floor + 21 latest CI matrix.

import 'zone.js';
import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';

// Counter.rozie copied into ./src/ so D-70's @rozie/unplugin disk-cache
// pre-emit (which walks the Vite project root from configResolved) finds
// it. The plan originally specified `@examples/Counter.rozie` via a Vite
// alias, but the D-70 prebuilder doesn't follow aliases — synthetic
// .rozie.ts virtual ids must live under the Vite project root for
// analogjs's TS Program glob to pick them up. The local copy approach
// matches the consumer demo (examples/consumers/angular-analogjs/) which
// also copies the .rozie files into src/. (Rule 3 — Blocking deviation
// from plan; correctness goal preserved: Counter.rozie compiles + boots.)
import Counter from './Counter.rozie';

@Component({
  selector: 'rozie-integration-app',
  standalone: true,
  imports: [Counter],
  template: `
    <h1>Rozie Angular Integration</h1>
    <rozie-counter
      [(value)]="value"
      [step]="1"
      [min]="-10"
      [max]="10"
    />
    <p>parent value: {{ value() }}</p>
  `,
})
export class IntegrationApp {
  value = signal(0);
}

bootstrapApplication(IntegrationApp).catch((err) => console.error(err));
