import type { Plugin } from 'vite';

/**
 * Phase 5 Plan 05-03 OQ3 spike — minimal Rozie-style synthetic id resolver.
 *
 * Mirrors @rozie/unplugin's resolveId/load pattern but with a hardcoded
 * payload. If this plugin's load hook is invoked by Vite AND analogjs's
 * transform consumes the returned `code` parameter (not reading from disk),
 * the spike succeeds (Path A).
 *
 * If analogjs reads from disk, the spike fails — Plan 05-04 must write the
 * generated .ts file to a temp dir (Path B per D-70 fallback).
 *
 * The id shape `synthetic.rozie.ts` mirrors what @rozie/unplugin will produce
 * in Plan 05-04: `Foo.rozie` → `<abs>/Foo.rozie.ts`. analogjs's
 * TS_EXT_REGEX = /\.[cm]?ts(?![a-z])/ matches `.ts` so the synthetic id
 * naturally flows into analogjs's transform hook.
 */
export function syntheticResolver(): Plugin {
  // Use a path-virtual style absolute id, mirroring how @rozie/unplugin
  // rewrites `Foo.rozie` → `<abs>/Foo.rozie.ts`.
  const VIRTUAL_ID_BARE = 'synthetic.rozie.ts';
  let virtualIdAbs: string | null = null;

  return {
    name: 'rozie-spike-synthetic-resolver',
    enforce: 'pre', // CRITICAL — must run before analogjs's resolver
    configResolved(config) {
      virtualIdAbs = `${config.root}/${VIRTUAL_ID_BARE}`;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID_BARE || id.endsWith('/' + VIRTUAL_ID_BARE)) {
        return virtualIdAbs;
      }
      return null;
    },
    load(id) {
      if (id !== virtualIdAbs) return null;
      // Hardcoded standalone Angular component — what Plan 05-04's
      // emitAngular will produce for examples/Counter.rozie.
      return `
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
    },
  };
}
